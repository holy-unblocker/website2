// Compile the built site with estrogen. Runs after `astro build`.
//
// Every first-party script, every proxy engine file, Ruffle, the service
// worker and the HU bootstrap go through estrogen's VM. The engine files used
// to be templated per request (renamed globals, service prefixes, hashed
// paths); VM bytecode cannot be templated, so this script mints one route seed,
// applies those same templates once, and has estrogen compile the result. It
// writes dist/server/proxy-build.json, and run-server.js serves every visitor
// that build's routes.
//
// ESTROGEN_BIN overrides the estrogen binary. HU_PROXY_SEED fixes the seed,
// for a reproducible build.
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { obfuscate } from "@sysce/estrogen";
import { estrogenCanaryJson, loadCanaries } from "./lib/leak-canaries.mjs";

// The templates below need the per-seed routes, not a previous build's.
delete process.env.HU_PROXY_BUILD_FILE;

const {
  createProxyRouteSeed,
  getProxyRouteMap,
  getVendorAssetRegistry,
  getVendorAssetSources,
  rewriteProxyGlobals,
} = await import("../src/lib/proxyRoutes.js");
const { proxyVendorSource, stripSourceMappingUrl, withProxyTemplates } =
  await import("../src/lib/proxyTemplates.js");
const { buildHUBrowserBootstrap } = await import("../src/lib/huRouter.js");

const require = createRequire(import.meta.url);
const root = process.cwd();
const client = path.join(root, "dist/client");
const server = path.join(root, "dist/server");
const privateDir = "estrogen-private";
const seed = process.env.HU_PROXY_SEED || createProxyRouteSeed();
const routes = getProxyRouteMap(seed);
// estrogen fails the build if any script chunk falls back from the bytecode
// VM, and if any file it writes to dist/client still holds a canary, in any
// case. scripts/leak-gate.mjs then checks every served file, the two in
// dist/server/estrogen-private included, encodings included.
const canaryDir = await mkdtemp(path.join(tmpdir(), "hu-estrogen-"));
const canary = path.join(canaryDir, "canaries.json");
await writeFile(canary, estrogenCanaryJson(await loadCanaries()));
const common = {
  binaryPath: process.env.ESTROGEN_BIN || undefined,
  requireVm: true,
  jobs: availableParallelism(),
  // dist/client is served as is; a manifest there would list the engine files.
  manifest: false,
};

// Files with no use at runtime. A source map holds the original source.
const dropped = /\.(?:map|d\.[cm]?ts)$/;

async function* scripts(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* scripts(full);
    else if (/\.m?js$/.test(entry.name)) yield full;
  }
}

// 1. The dev server renames the proxy globals in every script it serves.
//    Rename them in the app's own chunks before they become bytecode.
let renamed = 0;
for await (const file of scripts(path.join(client, "_astro"))) {
  const source = await readFile(file, "utf8");
  const out = rewriteProxyGlobals(source, routes);
  if (out === source) continue;
  await writeFile(file, out);
  renamed += 1;
}

// 2. Each engine file lands at its hashed /_astro/ path with the templates
//    the dev server applies per request.
const assets = new Map();
for (const asset of getVendorAssetRegistry().values())
  assets.set(asset.filePath, asset);
const roots = new Set(
  getVendorAssetSources().flatMap(([, dirs]) => [dirs].flat().filter(Boolean)),
);
const files = {};
const engines = [...roots].map((from) => ({
  from,
  to: "_astro",
  mode: "obfuscate",
  rename(relative, { file }) {
    const asset = assets.get(file);
    // An earlier root already serves this public path.
    if (!asset || dropped.test(relative)) return null;
    const hashed = routes.files[asset.publicPath];
    files[asset.publicPath] = hashed;
    return hashed.slice("/_astro/".length);
  },
  transform: (contents, { file }) =>
    proxyVendorSource(assets.get(file), routes, contents),
}));

// 3. Ruffle, which vite copied verbatim. Its scripts get the same global
//    rename every served script did.
const ruffle = {
  from: path.resolve(require.resolve("@ruffle-rs/ruffle"), ".."),
  to: "ruffle",
  mode: "obfuscate",
  rename: (relative) => (dropped.test(relative) ? null : undefined),
  transform: (contents, { path: relative }) =>
    /\.m?js$/.test(relative)
      ? rewriteProxyGlobals(contents.toString("utf8"), routes)
      : undefined,
};

const clientReport = await obfuscate({
  ...common,
  canary,
  canaryIgnoreCase: true,
  dirs: client,
  moduleGlobs: ["_astro/*.js"],
  vendor: [...engines, ruffle],
});

// 4. The server bundle, plus the two scripts it serves with this build's
//    routes baked in. They sit in dist/server so only their routes reach them:
//    the worker needs its scope header, and the bootstrap is per build.
//    No canary list here: the VM keeps a module's top-level binding names
//    (estrogen 0.5.5), and the SSR bundle, which no visitor is served, names
//    its own components and helpers after the engines. The leak gate checks
//    the two served files with estrogen --check and its own scan.
const serverReport = await obfuscate({
  ...common,
  dirs: server,
  moduleGlobs: ["**/*.js"],
  sharedRuntime: true,
  vendor: [
    {
      from: "src/lib/sw.js",
      to: `${privateDir}/sw.js`,
      mode: "obfuscate",
      transform: (contents) =>
        stripSourceMappingUrl(
          withProxyTemplates(contents.toString("utf8"), routes),
        ),
    },
    {
      from: "sdk/dist/browser/index.js",
      to: `${privateDir}/hu-bootstrap.js`,
      mode: "obfuscate",
      transform: () =>
        rewriteProxyGlobals(buildHUBrowserBootstrap(routes.hu), routes),
    },
  ],
});

await rm(canaryDir, { recursive: true, force: true });

await writeFile(
  path.join(server, "proxy-build.json"),
  JSON.stringify({
    seed,
    files,
    serviceWorker: `${privateDir}/sw.js`,
    bootstrap: `${privateDir}/hu-bootstrap.js`,
  }),
);

console.log(
  `estrogen: ${Object.keys(files).length} engine files vendored, ${renamed} app chunks renamed, ` +
    `client ${clientReport.durationMs} ms, server ${serverReport.durationMs} ms`,
);
