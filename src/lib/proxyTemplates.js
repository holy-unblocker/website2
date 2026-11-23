import { readFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";
import {
  proxyGlobalIdentifier,
  proxyUvConfigGlobal,
  rewriteProxyGlobals,
  rewriteWasmGlobals,
} from "./proxyRoutes.js";

// The text transforms that bind an engine file to one route map: renamed
// globals, the service prefixes, the service worker path and the hashed vendor
// paths. The dev server applies them per request (proxyAssetResponse.ts); a
// production build applies them once, before estrogen compiles each file
// (scripts/estrogen-build.mjs). Plain JS so both can import it.

const uvConfigTemplatePath = path.resolve(
  process.cwd(),
  "src/lib/uv.config.js",
);

let uvConfigTemplate;

function replaceStringLiteral(source, from, to) {
  let out = source;
  for (const quote of ["'", '"', "`"]) {
    out = out.replaceAll(`${quote}${from}${quote}`, `${quote}${to}${quote}`);
  }
  return out;
}

export function stripSourceMappingUrl(source) {
  return source.replace(/[\r\n]*\/\/[#@]\s*sourceMappingURL=.*/g, "");
}

export function patchUltravioletWorker(source) {
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

export function withProxyTemplates(source, routes, currentPublicPath) {
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

export async function uvConfigSource(routes) {
  uvConfigTemplate ??= readFile(uvConfigTemplatePath, "utf-8").then(
    async (source) =>
      (await transform(source, { minify: true, format: "iife" })).code,
  );
  const replacements = {
    UV_CONFIG_GLOBAL: proxyUvConfigGlobal(routes),
    UV_PREFIX: routes.uvConfig.prefix,
    UV_HANDLER: routes.uvConfig.handler,
    UV_BUNDLE: routes.uvConfig.bundle,
    UV_CONFIG: routes.uvConfig.config,
    UV_CLIENT: routes.uvConfig.client,
    UV_SW: routes.uvConfig.sw,
  };

  const template = await uvConfigTemplate;
  return template.replace(/%\{(\w+)\}/g, (match, key) => {
    const value = replacements[key];
    return value === undefined ? match : value;
  });
}

// The served text of one engine file: the same steps the dev server runs per
// request. `asset` is a vendor registry entry. Returns a string for script
// files, a Buffer for the wasm, and undefined for any other file, which ships
// unchanged.
export async function proxyVendorSource(asset, routes, contents) {
  const { filePath, publicPath } = asset;
  const ext = path.extname(filePath);
  if (path.basename(filePath) === "uv.config.js") return uvConfigSource(routes);
  // Ultraviolet's stock worker. Nothing registers it, but it is served with the
  // rest of the package. Its top-level `uv` and `handleRequest` would be
  // globals, and estrogen's VM keeps a classic script's global names in plain
  // text; inside a function they are locals the VM hides.
  if (publicPath === "/uv/sw.js")
    return stripSourceMappingUrl(
      withProxyTemplates(
        `(() => {\n${contents.toString("utf-8")}\n})();\n`,
        routes,
        publicPath,
      ),
    );
  if (publicPath === "/uv/uv.sw.js") {
    const source = patchUltravioletWorker(contents.toString("utf-8"));
    return withProxyTemplates(source, routes, publicPath);
  }
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    return stripSourceMappingUrl(
      withProxyTemplates(contents.toString("utf-8"), routes, publicPath),
    );
  }
  if (ext === ".wasm") return rewriteWasmGlobals(contents, routes);
}
