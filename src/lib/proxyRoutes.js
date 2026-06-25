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

export const torCookie = "t";
export const torCookieMaxAge = 60 * 60 * 24 * 400;

const require = createRequire(import.meta.url);
let vendorAssetRegistry;
const proxyAssetVersion = "2026-06-headers-v2";
const astroAssetBase = "/_astro";
const globalVariableNames = [
  "__uv",
  "$scramjetController",
  "$scramjet",
  "Ultraviolet",
  "UVServiceWorker",
  "@mercuryworkshop/scramjet",
  "scramjetGo",
  "scramjetConfig",
  "scramjetReady",
  "scramjetFrames",
  "ScramjetFrame",
  "scramjet-attr",
  "SCRAMJET",
  "scramjetPath",
  "scramjetWasm",
  "setupScramjet",
  "ScramjetClient",
  "scramjet client",
  "scramjet-injected",
  "ScramjetHeaders",
  "ScramjetFetchTrackedClient",
  "ScramjetFetchHandler",
  "&quot;scramjet;&quot;",
  "createScramjetTransport",
  "activeScramjetController",
  "getScramjetPrefix",
  "Scramjet",
  "loadScramjetWasm",
  "__scramjet_controller",
  "__scramjet_controller_channel",
  /(?<![/_-])bare-mux(-path)?(?![/_-])/g,
  "scramjetTargetHostname",
];
export const obfuscatedVendorRoot = path.resolve(
  process.cwd(),
  "dist/client/_proxy-vendor",
);

export function getObfuscatedVendorPath(publicPath) {
  return path.join(obfuscatedVendorRoot, publicPath.replace(/^\/+/, ""));
}

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
    .slice(0, 8);
}

function routePath(seed, label, ext = "") {
  return `${astroAssetBase}/${segment(seed, label)}${ext}`;
}

function routePrefix(seed, label, ext = ".js") {
  return `${astroAssetBase}/${segment(seed, label)}${ext}/`;
}

function globalIdentifier(seed, label) {
  const length = label.length;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto
    .createHash("sha512")
    .update(seed)
    .update(":global:")
    .update(label)
    .digest();
  let identifier = "";
  let offset = 0;

  while (identifier.length < length) {
    if (offset >= bytes.length) {
      const extra = crypto
        .createHash("sha512")
        .update(seed)
        .update(":global:")
        .update(label)
        .update(":")
        .update(String(identifier.length))
        .digest();
      for (const byte of extra) {
        identifier += charset[byte % charset.length];
        if (identifier.length === length) break;
      }
      break;
    }
    identifier += charset[bytes[offset] % charset.length];
    offset += 1;
  }

  return identifier;
}

export function proxyGlobalIdentifier(routes, label) {
  const normalizedSeed =
    typeof routes.seed === "string" && routes.seed ? routes.seed : "default";
  return globalIdentifier(normalizedSeed, label);
}

export function proxyUvConfigGlobal(routes) {
  return `${proxyGlobalIdentifier(routes, "__uv")}$config`;
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
          obfuscatedFilePath: getObfuscatedVendorPath(publicPath),
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
  const paths = {
    serviceWorker: routePath(normalizedSeed, "service-worker", ".js"),
    uvService: routePrefix(normalizedSeed, "uv-service"),
    scramService: routePrefix(normalizedSeed, "scram-service"),
    // register pages are rendered via an internal rewrite to the /register
    // route with the engine in the query string. they intentionally do NOT use
    // the /_astro/ asset base: that prefix is owned by vite's static handler in
    // dev and would 404 before astro's page router runs.
    registerUV: "/register?uv",
    registerSJ: "/register?sj",
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
    sj: file(files, "/scram/scramjet.js"),
    sjWasm: file(files, "/scram/scramjet.wasm"),
    sjControllerApi: file(files, "/scramjet/controller.api.js"),
    sjControllerInject: file(files, "/scramjet/controller.inject.js"),
    sjControllerSw: file(files, "/scramjet/controller.sw.js"),
  };

  return {
    seed: normalizedSeed,
    files,
    routeFiles,
    paths,
    assets,
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
      scramjetPath: assets.sj,
      wasmPath: assets.sjWasm,
      injectPath: assets.sjControllerInject,
    },
  };
}

export function getProxyAsset(routes, pathname) {
  const publicPath = routes.routeFiles[pathname];
  if (!publicPath) return;
  return getVendorAssetRegistry().get(publicPath);
}

export function rewriteProxyGlobals(source, routes) {
  const scramjetPlaceholder = "__HU_SCRAMJET_GLOBAL__";
  const scramjetControllerPlaceholder = "__HU_SCRAMJET_CONTROLLER_GLOBAL__";

  let out = source;
  for (const original of globalVariableNames) {
    if (original instanceof RegExp) {
      // use the regex source (without flags) as the stable label so the
      // obfuscated identifier is deterministic across requests.
      const obfuscated = proxyGlobalIdentifier(routes, original.source);
      out = out.replaceAll(original, obfuscated);
      continue;
    }
    const obfuscated = proxyGlobalIdentifier(routes, original);
    if (original === "$scramjetController") {
      out = out.replaceAll(original, scramjetControllerPlaceholder);
    } else if (original === "$scramjet") {
      out = out.replaceAll(original, scramjetPlaceholder);
    } else {
      out = out.replaceAll(original, obfuscated);
    }
  }
  out = out.replaceAll(
    scramjetControllerPlaceholder,
    proxyGlobalIdentifier(routes, "$scramjetController"),
  );
  out = out.replaceAll(
    scramjetPlaceholder,
    proxyGlobalIdentifier(routes, "$scramjet"),
  );
  return out;
}

export function serializeProxyRoutes(routes) {
  return JSON.stringify({
    paths: routes.paths,
    assets: routes.assets,
    uvConfig: routes.uvConfig,
    sjConfig: routes.sjConfig,
  });
}
