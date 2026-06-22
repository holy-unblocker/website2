import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";

export const proxyRouteCookie = "re";
export const proxyRouteCookieMaxAge = 60 * 60 * 24 * 400;

const require = createRequire(import.meta.url);
let vendorAssetRegistry;
const proxyAssetVersion = "2026-06-headers-v2";
const astroAssetBase = "/_astro";

function packageDist(specifier) {
  let dir = path.dirname(require.resolve(specifier));
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json")))
      return path.join(dir, "dist");
    dir = path.dirname(dir);
  }
  throw new Error(`Unable to resolve dist dir for ${specifier}`);
}

export const vendorRoots = {
  uv: uvPath,
  baremux: baremuxPath,
  baremod: bareModulePath,
  epoxy: packageDist("@mercuryworkshop/epoxy-transport"),
  libcurl: packageDist("@mercuryworkshop/libcurl-transport"),
  scram: scramjetPath,
  scramjet: [
    path.resolve(require.resolve("@mercuryworkshop/scramjet-controller"), ".."),
    path.resolve(require.resolve("@mercuryworkshop/scramjet-utils"), ".."),
  ],
};

export const vendorAssetSources = [
  ["/uv/", vendorRoots.uv],
  ["/baremux/", vendorRoots.baremux],
  ["/baremod/", vendorRoots.baremod],
  ["/epoxy/", vendorRoots.epoxy],
  ["/libcurl/", vendorRoots.libcurl],
  ["/scram/", vendorRoots.scram],
  ["/scramjet/", vendorRoots.scramjet],
];

export function createProxyRouteSeed() {
  return crypto.randomBytes(24).toString("hex");
}

function segment(seed, label) {
  return crypto
    .createHash("sha256")
    .update(seed)
    .update(":")
    .update(label)
    .digest("base64url")
    .slice(0, 18);
}

function routePath(seed, label, ext = "") {
  return `${astroAssetBase}/${segment(seed, label)}${ext}`;
}

function routePrefix(seed, label, ext = ".js") {
  return `${astroAssetBase}/${segment(seed, label)}${ext}/`;
}

function walkFiles(root, dir = "") {
  const currentDir = path.join(root, dir);
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(root, relative));
    else if (entry.isFile()) files.push(relative.split(path.sep).join("/"));
  }

  return files;
}

export function getVendorAssetRegistry() {
  if (vendorAssetRegistry) return vendorAssetRegistry;

  const assets = new Map();
  for (const [publicBase, roots] of vendorAssetSources) {
    const rootList = Array.isArray(roots) ? roots : [roots];
    for (const root of rootList) {
      for (const relativePath of walkFiles(root)) {
        const publicPath = `${publicBase}${relativePath}`;
        if (assets.has(publicPath)) continue;
        assets.set(publicPath, {
          publicBase,
          publicPath,
          filePath: path.join(root, relativePath),
        });
      }
    }
  }

  vendorAssetRegistry = assets;
  return assets;
}

function vendorFileRoutes(seed) {
  const files = {};
  const routeFiles = {};

  for (const publicPath of getVendorAssetRegistry().keys()) {
    const ext = path.extname(publicPath);
    const hashedPath = routePath(
      seed,
      `${proxyAssetVersion}:asset:${publicPath}`,
      ext,
    );
    files[publicPath] = hashedPath;
    routeFiles[hashedPath] = publicPath;
  }

  return { files, routeFiles };
}

function file(files, publicPath) {
  const resolved = files[publicPath];
  if (!resolved) throw new Error(`Missing proxy vendor asset: ${publicPath}`);
  return resolved;
}

export function getProxyRouteMap(seed) {
  const normalizedSeed = typeof seed === "string" && seed ? seed : "default";
  const { files, routeFiles } = vendorFileRoutes(normalizedSeed);
  const uvConfigSuffix = segment(normalizedSeed, "uv-config").replaceAll(
    "-",
    "_",
  );
  const scramjetGlobalSuffix = segment(
    normalizedSeed,
    "scramjet-global",
  ).replaceAll("-", "_");

  const paths = {
    serviceWorker: routePath(normalizedSeed, "service-worker", ".js"),
    uvService: routePrefix(normalizedSeed, "uv-service"),
    scramService: routePrefix(normalizedSeed, "scram-service"),
    registerUV: routePath(normalizedSeed, "register-uv", ".html"),
    registerScramjet: routePath(normalizedSeed, "register-scramjet", ".html"),
  };

  const assets = {
    baremuxIndex: file(files, "/baremux/index.js"),
    baremuxWorker: file(files, "/baremux/worker.js"),
    baremodIndex: file(files, "/baremod/index.mjs"),
    epoxyIndex: file(files, "/epoxy/index.mjs"),
    libcurlIndex: file(files, "/libcurl/index.mjs"),
    uvBundle: file(files, "/uv/uv.bundle.js"),
    uvConfig: file(files, "/uv/uv.config.js"),
    uvHandler: file(files, "/uv/uv.handler.js"),
    uvClient: file(files, "/uv/uv.client.js"),
    uvSw: file(files, "/uv/uv.sw.js"),
    scramjet: file(files, "/scram/scramjet.js"),
    scramjetWasm: file(files, "/scram/scramjet.wasm"),
    scramjetControllerApi: file(files, "/scramjet/controller.api.js"),
    scramjetControllerInject: file(files, "/scramjet/controller.inject.js"),
    scramjetControllerSw: file(files, "/scramjet/controller.sw.js"),
  };
  const globals = {
    uvConfig: uvConfigSuffix,
    scramjet: scramjetGlobalSuffix,
    scramjetController: scramjetGlobalSuffix,
  };

  return {
    seed: normalizedSeed,
    files,
    routeFiles,
    paths,
    assets,
    globals,
    uvConfigGlobal: globals.uvConfig,
    uvConfig: {
      prefix: paths.uvService,
      handler: assets.uvHandler,
      bundle: assets.uvBundle,
      config: assets.uvConfig,
      client: assets.uvClient,
      sw: assets.uvSw,
    },
    sjConfig: {
      prefix: paths.scramService,
      scramjetPath: assets.scramjet,
      wasmPath: assets.scramjetWasm,
      injectPath: assets.scramjetControllerInject,
    },
  };
}

export function getProxyAsset(routes, pathname) {
  const publicPath = routes.routeFiles[pathname];
  if (!publicPath) return;
  return getVendorAssetRegistry().get(publicPath);
}

export function serializeProxyRoutes(routes) {
  return JSON.stringify({
    paths: routes.paths,
    assets: routes.assets,
    globals: routes.globals,
    uvConfigGlobal: routes.uvConfigGlobal,
    uvConfig: routes.uvConfig,
    sjConfig: routes.sjConfig,
  });
}
