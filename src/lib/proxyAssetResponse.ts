import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Readable } from "node:stream";
import { transform } from "esbuild";
import {
  getProxyAsset,
  proxyGlobalIdentifier,
  proxyUvConfigGlobal,
  rewriteProxyGlobals,
} from "@lib/proxyRoutes.js";

const require = createRequire(import.meta.url);
const publicRoot = path.resolve(process.cwd(), "public");
const serviceWorkerPath = path.resolve(process.cwd(), "src/lib/sw.js");
const uvConfigTemplatePath = path.resolve(
  process.cwd(),
  "src/lib/uv.config.js",
);
const staticRoots = [path.resolve(process.cwd(), "dist/client"), publicRoot];
const ruffleRoot = path.resolve(require.resolve("@ruffle-rs/ruffle"), "..");

const uvConfigTemplate = (async () => {
  const source = await readFile(uvConfigTemplatePath, "utf-8");
  const { code } = await transform(source, {
    minify: true,
    format: "iife",
  });
  return code;
})();

const contentTypes: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".cjs": "application/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function headersFor(filePath: string) {
  const ext = path.extname(filePath);
  return {
    "content-type": contentTypes[ext] ?? "application/octet-stream",
    "cache-control": "private, max-age=31536000, immutable",
    "cross-origin-resource-policy": "same-origin",
  };
}

function cacheControlFor(publicPath: string) {
  if (publicPath === "/uv/uv.sw.js") return "private, no-cache";
  if (publicPath.startsWith("/scramjet/controller."))
    return "private, no-cache";
  return "private, max-age=31536000, immutable";
}

function replaceStringLiteral(source: string, from: string, to: string) {
  let out = source;
  for (const quote of ["'", '"', "`"]) {
    out = out.replaceAll(`${quote}${from}${quote}`, `${quote}${to}${quote}`);
  }
  return out;
}

function stripSourceMappingUrl(source: string) {
  return source.replace(/[\r\n]*\/\/[#@]\s*sourceMappingURL=.*/g, "");
}

function patchUltravioletWorker(source: string) {
  // Normalize bare-mux rawHeaders (array or numeric-keyed object) into a plain object.
  const patched = source.replace(
    "for(let t in o.rawHeaders)this.headers[t.toLowerCase()]=o.rawHeaders[t]",
    "for(let t in o.rawHeaders){let e=o.rawHeaders[t];if(Array.isArray(e))this.headers[String(e[0]).toLowerCase()]=e[1];else if(/^\\d+$/.test(t)){let o=String(e),r=o.indexOf(',');r>0&&(this.headers[o.slice(0,r).toLowerCase()]=o.slice(r+1))}else this.headers[t.toLowerCase()]=e}",
  );
  if (patched === source) {
    throw new Error("Unable to patch Ultraviolet worker raw headers.");
  }
  return patched;
}

function withProxyTemplates(
  source: string,
  routes: App.Locals["proxyRoutes"],
  currentPublicPath?: string,
) {
  let out = rewriteProxyGlobals(source, routes);
  out = out.replaceAll("/scram/service/", routes.paths.scramService);
  out = out.replaceAll("/sw.js", routes.paths.serviceWorker);

  const files = Object.entries(routes.files).sort(
    ([left], [right]) => right.length - left.length,
  );
  for (const [publicPath, hashedPath] of files) {
    out = out.replaceAll(publicPath, hashedPath);
  }

  if (currentPublicPath) {
    const currentDir = path.posix.dirname(currentPublicPath);
    for (const [publicPath, hashedPath] of files) {
      if (publicPath === currentPublicPath) continue;
      const relative = path.posix.relative(currentDir, publicPath);
      if (!relative || relative.startsWith("..")) continue;
      out = replaceStringLiteral(out, relative, hashedPath);
      out = replaceStringLiteral(out, `./${relative}`, hashedPath);
    }
  }

  out = out.replaceAll(
    /\bscramjet\b/g,
    proxyGlobalIdentifier(routes, "scramjet"),
  );

  return out;
}

async function uvConfigSource(routes: App.Locals["proxyRoutes"]) {
  const replacements: Record<string, string> = {
    UV_CONFIG_GLOBAL: proxyUvConfigGlobal(routes),
    UV_PREFIX: routes.uvConfig.prefix,
    UV_HANDLER: routes.uvConfig.handler,
    UV_BUNDLE: routes.uvConfig.bundle,
    UV_CONFIG: routes.uvConfig.config,
    UV_CLIENT: routes.uvConfig.client,
    UV_SW: routes.uvConfig.sw,
  };

  const template = await uvConfigTemplate;
  return template.replace(/%\{(\w+)\}/g, (match, key: string) => {
    const value = replacements[key];
    return value === undefined ? match : value;
  });
}

async function existingVendorFile(
  roots: string | string[],
  requestedPath: string,
) {
  const rootList = Array.isArray(roots) ? roots : [roots];
  for (const root of rootList) {
    const candidate = path.resolve(root, requestedPath);
    const relative = path.relative(root, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
}

function fileResponse(filePath: string, cacheControl: string) {
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      ...headersFor(filePath),
      "cache-control": cacheControl,
    },
  });
}

async function vendorResponse(
  asset: NonNullable<ReturnType<typeof getProxyAsset>>,
  routes: App.Locals["proxyRoutes"],
  isMainWebsite: boolean,
) {
  const { filePath, obfuscatedFilePath, publicPath } = asset;
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);
  const shouldTemplate = ext === ".js" || ext === ".mjs" || ext === ".cjs";

  if (basename === "uv.config.js") {
    return new Response(await uvConfigSource(routes), {
      headers: {
        ...headersFor(filePath),
        "cache-control": cacheControlFor(publicPath),
      },
    });
  }

  if (shouldTemplate) {
    let sourcePath = filePath;
    try {
      await access(obfuscatedFilePath);
      sourcePath = obfuscatedFilePath;
    } catch {}

    let source = await readFile(sourcePath, "utf-8");
    if (!isMainWebsite) {
      source = stripSourceMappingUrl(
        withProxyTemplates(source, routes, publicPath),
      );
    }
    return new Response(source, {
      headers: {
        ...headersFor(filePath),
        "cache-control": cacheControlFor(publicPath),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      ...headersFor(filePath),
      "cache-control": cacheControlFor(publicPath),
    },
  });
}

export async function proxyAssetResponse(
  pathname: string,
  routes: App.Locals["proxyRoutes"],
  isMainWebsite: boolean,
) {
  if (pathname === routes.paths.serviceWorker) {
    const source = await readFile(serviceWorkerPath, "utf-8");
    const responseSource = isMainWebsite
      ? source
      : stripSourceMappingUrl(withProxyTemplates(source, routes));
    return new Response(responseSource, {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "private, no-cache",
        "service-worker-allowed": "/",
      },
    });
  }

  const asset = getProxyAsset(routes, pathname);
  if (asset) {
    if (pathname === routes.assets.uvSw) {
      let source = await readFile(asset.filePath, "utf-8");
      source = patchUltravioletWorker(source);
      source = withProxyTemplates(source, routes, asset.publicPath);
      return new Response(source, {
        headers: {
          ...headersFor(asset.filePath),
          "cache-control": cacheControlFor(asset.publicPath),
        },
      });
    }
    return vendorResponse(asset, routes, isMainWebsite);
  }
}

export async function staticAssetResponse(pathname: string) {
  if (pathname.startsWith("/ruffle/")) {
    const filePath = await existingVendorFile(
      ruffleRoot,
      decodeURIComponent(pathname.slice("/ruffle/".length)),
    );
    if (filePath)
      return fileResponse(filePath, "public, max-age=31536000, immutable");
  }

  const filePath = await existingVendorFile(
    staticRoots,
    decodeURIComponent(pathname.slice(1)),
  );
  if (filePath) return fileResponse(filePath, "public, max-age=3600");
}
