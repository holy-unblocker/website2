import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Readable } from "node:stream";
import { getProxyAsset, getProxyBuild } from "@lib/proxyRoutes.js";
import {
  proxyVendorSource,
  stripSourceMappingUrl,
  withProxyTemplates,
} from "@lib/proxyTemplates.js";

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
  const { filePath, obfuscatedFilePath, publicPath } = asset;
  const headers = {
    ...headersFor(filePath),
    "cache-control": cacheControlFor(publicPath),
  };
  const ext = path.extname(filePath);
  let sourcePath = filePath;
  if (
    (ext === ".js" || ext === ".mjs" || ext === ".cjs") &&
    publicPath !== "/uv/uv.sw.js"
  ) {
    try {
      await access(obfuscatedFilePath);
      sourcePath = obfuscatedFilePath;
    } catch {}
  }
  const served = await proxyVendorSource(
    asset,
    routes,
    await readFile(sourcePath),
  );
  if (served !== undefined) return new Response(served, { headers });

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers });
}

export async function proxyAssetResponse(
  pathname: string,
  routes: App.Locals["proxyRoutes"],
) {
  if (pathname === routes.paths.serviceWorker) {
    // A build compiled the worker once with its routes; it lives outside
    // dist/client so it is only ever served here, with the scope header.
    const build = getProxyBuild();
    const responseSource = build
      ? await readFile(build.serviceWorker, "utf-8")
      : stripSourceMappingUrl(
          withProxyTemplates(
            await readFile(serviceWorkerPath, "utf-8"),
            routes,
          ),
        );
    return new Response(responseSource, {
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
  // A build vendors Ruffle into dist/client/ruffle through estrogen, so only
  // the dev server reads it from node_modules.
  if (pathname.startsWith("/ruffle/") && !getProxyBuild()) {
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
