import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export {
  proxyRouteCookie,
  proxyRouteCookieMaxAge,
  torCookie,
  torCookieMaxAge,
} from "./proxyRouteCookies.js";

// This module is a data/router module. It must NEVER import the proxy engines
// (Ultraviolet, scramjet, bare, bare-mux) at the top level: merely importing it
// — or importing the SDK server/router that bundles it — must not load an
// engine. The engine dist paths are needed only to serve engine assets under
// the vendor routes, so they are resolved either from host-injected paths
// (setEnginePaths) or lazily, the first time an engine asset route is actually
// served, via this createRequire shim — never via esbuild's __require stub.
// The shim is defined here, before any engine access.
const require = createRequire(import.meta.url);

let vendorAssetRegistry;
let injectedEnginePaths = null;
let cachedVendorRoots;

/**
 * Inject engine dist paths from the host so the engine packages are never
 * required at all: { uv?, bareModule?, bareMux?, scramjet? } (each an absolute
 * path to that engine's dist dir). Any path left out falls back to lazy
 * package resolution. Resetting clears the memoized roots/registry.
 */
export function setEnginePaths(paths) {
  injectedEnginePaths = paths && typeof paths === "object" ? paths : null;
  cachedVendorRoots = undefined;
  vendorAssetRegistry = undefined;
}

// Lazily read a named path export (e.g. `uvPath`) from an engine package via
// the createRequire shim. Returns undefined when the engine is not installed,
// so a host that never serves that engine's assets never needs it.
function resolveEnginePath(specifier, named) {
  try {
    const mod = require(specifier);
    const value = mod?.[named];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

// Lazily resolve a package's dir via the createRequire shim; undefined if the
// package is absent.
function safeResolveDir(specifier) {
  try {
    return path.resolve(require.resolve(specifier), "..");
  } catch {
    return undefined;
  }
}
const proxyAssetVersion = "2026-06-headers-v2";
const astroAssetBase = "/_astro";
const globalVariableNames = [
  "__uv",
  "$scramjetController",
  "$scramjet",
  "$scramitize",
  "scramitize",
  "$scramerr",
  "$scramdbg",
  "scramtag",
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

function safePackageDist(specifier) {
  try {
    return packageDist(specifier);
  } catch {
    return undefined;
  }
}

/**
 * Engine dist roots, resolved lazily (and memoized) on first use. Host-injected
 * paths (setEnginePaths) win over package resolution; any engine that is both
 * uninjected and uninstalled resolves to undefined and is skipped by the asset
 * registry. Because this never runs at import time, importing this module (or
 * the SDK router) never touches an engine.
 */
export function getVendorRoots() {
  if (cachedVendorRoots) return cachedVendorRoots;
  const injected = injectedEnginePaths ?? {};
  cachedVendorRoots = {
    uv:
      injected.uv ??
      resolveEnginePath("@titaniumnetwork-dev/ultraviolet", "uvPath"),
    baremux:
      injected.bareMux ??
      resolveEnginePath("@mercuryworkshop/bare-mux/node", "baremuxPath"),
    baremod:
      injected.bareModule ??
      resolveEnginePath("@mercuryworkshop/bare-as-module3", "bareModulePath"),
    epoxy: safePackageDist("@mercuryworkshop/epoxy-transport"),
    libcurl: safePackageDist("@mercuryworkshop/libcurl-transport"),
    scram:
      injected.scramjet ??
      resolveEnginePath("@mercuryworkshop/scramjet/path", "scramjetPath"),
    scramjet: [
      safeResolveDir("@mercuryworkshop/scramjet-controller"),
      safeResolveDir("@mercuryworkshop/scramjet-utils"),
    ].filter(Boolean),
  };
  return cachedVendorRoots;
}

export function getVendorAssetSources() {
  const roots = getVendorRoots();
  return [
    ["/uv/", roots.uv],
    ["/baremux/", roots.baremux],
    ["/baremod/", roots.baremod],
    ["/epoxy/", roots.epoxy],
    ["/libcurl/", roots.libcurl],
    ["/scram/", roots.scram],
    ["/scramjet/", roots.scramjet],
  ];
}

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
  for (const [publicBase, roots] of getVendorAssetSources()) {
    const rootList = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
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

export function getProxyRouteMap(seed, mount = "/cdn/") {
  const normalizedSeed = typeof seed === "string" && seed ? seed : "default";
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

  const hu = {
    queryPath: huPath(normalizedSeed, mount, "query"),
    gamePath: huPath(normalizedSeed, mount, "game"),
    playPath: huPath(normalizedSeed, mount, "play"),
    playerPath: `${huPath(normalizedSeed, mount, "player")}.html`,
    launchBase: "/hub/",
    webretroPath: huPath(normalizedSeed, mount, "webretro"),
    assetPrefix: `${huPath(normalizedSeed, mount, "asset")}/`,
    imagePrefix: `${huPath(normalizedSeed, mount, "image")}/`,
  };

  // The engine-dependent sections (files/routeFiles/assets/uvConfig/sjConfig)
  // are resolved lazily and memoized, so merely building the route map — as
  // shouldRoute() does on every request — never walks an engine's dist tree or
  // loads an engine. They are computed only when a consumer actually reads one
  // of them, i.e. when serving engine assets. The data API, opaque-token routes
  // and upgrade matching read only `seed`, `paths` and `hu`, which are pure
  // seed-derived values.
  let fileRoutes;
  let assetMap;
  function ensureFileRoutes() {
    if (!fileRoutes) fileRoutes = vendorFileRoutes(normalizedSeed);
    return fileRoutes;
  }
  function ensureAssets() {
    if (assetMap) return assetMap;
    const { files } = ensureFileRoutes();
    assetMap = {
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
    return assetMap;
  }

  return {
    seed: normalizedSeed,
    paths,
    hu,
    get files() {
      return ensureFileRoutes().files;
    },
    get routeFiles() {
      return ensureFileRoutes().routeFiles;
    },
    get assets() {
      return ensureAssets();
    },
    get uvConfig() {
      const assets = ensureAssets();
      return {
        prefix: paths.uvService,
        handler: assets.uvHandler,
        bundle: assets.uvBundle,
        config: assets.uvConfig,
        client: assets.uvClient,
        sw: assets.uvSw,
      };
    },
    get sjConfig() {
      const assets = ensureAssets();
      return {
        prefix: paths.scramService,
        // The controller bundle reads `config.scramjetPath`, which is rewritten
        // by rewriteProxyGlobals to the obfuscated identifier. Emit the value
        // under that same obfuscated key so the controller can resolve it.
        [globalIdentifier(normalizedSeed, "scramjetPath")]: assets.sj,
        wasmPath: assets.sjWasm,
        injectPath: assets.sjControllerInject,
      };
    },
  };
}

export function getProxyAsset(routes, pathname) {
  const publicPath = routes.routeFiles[pathname];
  if (!publicPath) return;
  return getVendorAssetRegistry().get(publicPath);
}

export function rewriteProxyGlobals(source, routes) {
  let out = source;
  const orderedGlobals = [...globalVariableNames].sort((left, right) => {
    const leftLength =
      left instanceof RegExp ? left.source.length : left.length;
    const rightLength =
      right instanceof RegExp ? right.source.length : right.length;
    return rightLength - leftLength;
  });

  for (const original of orderedGlobals) {
    const obfuscated = proxyGlobalIdentifier(
      routes,
      original instanceof RegExp ? original.source : original,
    );
    out = out.replaceAll(original, obfuscated);
  }

  return out;
}

// Identifiers that the Scramjet rewriter WASM emits verbatim into rewritten
// page JS. These must match the obfuscated globals defined by the core runtime
// bundle. Each entry is rewritten in-place inside the WASM binary using a
// length-preserving obfuscated identifier so the module stays byte-valid (WASM
// string literals carry LEB128 length prefixes that must not change).
const wasmEmbeddedGlobals = [
  "$scramjet",
  "$scramitize",
  "$scramerr",
  "scramtag",
];

export function rewriteWasmGlobals(buffer, routes) {
  let text = Buffer.from(buffer).toString("latin1");
  let changed = false;

  const ordered = [...wasmEmbeddedGlobals].sort(
    (left, right) => right.length - left.length,
  );

  for (const original of ordered) {
    const obfuscated = proxyGlobalIdentifier(routes, original);
    if (obfuscated.length !== original.length) continue;
    if (!text.includes(original)) continue;
    text = text.split(original).join(obfuscated);
    changed = true;
  }

  if (!changed) return Buffer.from(buffer);

  const rewritten = Buffer.from(text, "latin1");
  if (rewritten.length !== buffer.length || !WebAssembly.validate(rewritten)) {
    return Buffer.from(buffer);
  }
  return rewritten;
}

function huPath(seed, mount, label) {
  const normalizedMount = mount.endsWith("/") ? mount : `${mount}/`;
  return `${normalizedMount}${segment(seed, `hu:${label}:a`)}/${segment(seed, `hu:${label}:b`)}`;
}

function huToken(seed, label, value) {
  const payload = Buffer.from(value, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", seed)
    .update(`hu:${label}:${value}`)
    .digest("base64url")
    .slice(0, 16);
  return `${payload}.${signature}`;
}

function readHuToken(seed, label, token) {
  if (typeof token !== "string") return;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return;

  let value;
  try {
    value = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return;
  }

  const expected = crypto
    .createHmac("sha256", seed)
    .update(`hu:${label}:${value}`)
    .digest("base64url")
    .slice(0, 16);

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return;
  if (!crypto.timingSafeEqual(left, right)) return;

  return value;
}

export function createHULaunchPath(routes, id) {
  const base = routes.hu.launchBase ?? "/hub/";
  return `${base}?v=${encodeURIComponent(huToken(routes.seed, "launch", id))}`;
}

export function readHULaunchId(routes, token) {
  return readHuToken(routes.seed, "launch", token);
}

export function createHUAssetPath(routes, value) {
  const tokenPath = `${routes.hu.assetPrefix}${huToken(routes.seed, "asset", value)}`;
  return value.endsWith("/") ? `${tokenPath}/` : tokenPath;
}

export function readHUAssetValue(routes, pathname) {
  if (!pathname.startsWith(routes.hu.assetPrefix)) return;
  const remainder = pathname.slice(routes.hu.assetPrefix.length);
  const [token, ...suffixParts] = remainder.split("/");
  if (!token) return;
  const value = readHuToken(routes.seed, "asset", token);
  if (typeof value !== "string") return;
  if (
    suffixParts.length === 0 ||
    (suffixParts.length === 1 && suffixParts[0] === "")
  ) {
    return value;
  }
  if (!value.endsWith("/")) return;
  return value + suffixParts.join("/");
}

export function createHUImagePath(routes, id) {
  return `${routes.hu.imagePrefix}${huToken(routes.seed, "image", id)}.webp`;
}

export function readHUImageId(routes, pathname) {
  if (!pathname.startsWith(routes.hu.imagePrefix)) return;
  const token = pathname
    .slice(routes.hu.imagePrefix.length)
    .replace(/\.webp$/, "");
  return readHuToken(routes.seed, "image", token);
}

export function serializeProxyRoutes(routes) {
  return JSON.stringify({
    paths: routes.paths,
    assets: routes.assets,
    uvConfig: routes.uvConfig,
    sjConfig: routes.sjConfig,
    hu: routes.hu,
  });
}
