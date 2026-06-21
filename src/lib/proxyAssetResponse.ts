import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Readable } from "node:stream";
import { getProxyAsset } from "@lib/proxyRoutes.js";

const require = createRequire(import.meta.url);
const publicRoot = path.resolve(process.cwd(), "public");
const serviceWorkerPath = path.resolve(process.cwd(), "src/lib/sw.js");
const staticRoots = [path.resolve(process.cwd(), "dist/client"), publicRoot];
const ruffleRoot = path.resolve(require.resolve("@ruffle-rs/ruffle"), "..");

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

function withProxyTemplates(
  source: string,
  routes: App.Locals["proxyRoutes"],
  currentPublicPath?: string,
) {
  let out = source.replaceAll("__uv$config", routes.uvConfigGlobal);
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

  return out;
}

function uvConfigSource(routes: App.Locals["proxyRoutes"]) {
  return `self[${JSON.stringify(routes.uvConfigGlobal)}] = {\n  prefix: ${JSON.stringify(routes.uvConfig.prefix)},\n  encodeUrl: Ultraviolet.codec.xor.encode,\n  decodeUrl: Ultraviolet.codec.xor.decode,\n  handler: ${JSON.stringify(routes.uvConfig.handler)},\n  bundle: ${JSON.stringify(routes.uvConfig.bundle)},\n  config: ${JSON.stringify(routes.uvConfig.config)},\n  client: ${JSON.stringify(routes.uvConfig.client)},\n  sw: ${JSON.stringify(routes.uvConfig.sw)},\n};\nself.__uv$config = self[${JSON.stringify(routes.uvConfigGlobal)}];\n`;
}

function patchScramjetControllerWorker(source: string) {
  const patched = source.replace(
    "headers:n.headers",
    "headers:((e,s)=>{let t=new Headers,r=Array.isArray(e)?e:Object.entries(e||{});for(let[e,o]of r){if(Array.isArray(o))t.append(o[0],o[1]);else if(/^\\d+$/.test(e)){let s=String(o),r=s.indexOf(',');r>0&&t.append(s.slice(0,r),s.slice(r+1))}else t.append(e,String(o))}let o=t.get('location');if(o){try{let e=new URL(o,s),r='/'+encodeURIComponent(e.href);t.set('location',location.origin+$scramjet.config.prefix+'x/'+r)}catch{}}return t})(n.headers,o&&o.url)",
  );
  if (patched === source) {
    throw new Error("Unable to patch Scramjet controller worker headers.");
  }
  return patched;
}

function patchUltravioletWorker(source: string) {
  const patched = source.replace(
    "for(let t in o.rawHeaders)this.headers[t.toLowerCase()]=o.rawHeaders[t]",
    "for(let t in o.rawHeaders){let e=o.rawHeaders[t];if(Array.isArray(e))this.headers[String(e[0]).toLowerCase()]=e[1];else if(/^\\d+$/.test(t)){let o=String(e),r=o.indexOf(',');r>0&&(this.headers[o.slice(0,r).toLowerCase()]=o.slice(r+1))}else this.headers[t.toLowerCase()]=e}",
  );
  if (patched === source) {
    throw new Error("Unable to patch Ultraviolet worker raw headers.");
  }
  return patched;
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
) {
  const { filePath, publicPath } = asset;
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);
  const shouldTemplate = ext === ".js" || ext === ".mjs" || ext === ".cjs";

  if (basename === "uv.config.js") {
    return new Response(uvConfigSource(routes), {
      headers: {
        ...headersFor(filePath),
        "cache-control": cacheControlFor(publicPath),
      },
    });
  }

  if (shouldTemplate) {
    let source = await readFile(filePath, "utf-8");
    if (publicPath === "/uv/uv.sw.js") {
      source = patchUltravioletWorker(source);
    }
    if (publicPath === "/scramjet/controller.sw.js") {
      source = patchScramjetControllerWorker(source);
    }
    return new Response(withProxyTemplates(source, routes, publicPath), {
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
) {
  if (pathname === routes.paths.serviceWorker) {
    const source = await readFile(serviceWorkerPath, "utf-8");
    return new Response(withProxyTemplates(source, routes), {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "private, no-cache",
        "service-worker-allowed": "/",
      },
    });
  }

  const asset = getProxyAsset(routes, pathname);
  if (asset) return vendorResponse(asset, routes);
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
