import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dist = resolve(__dirname, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "client"), { recursive: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, "shared"), { recursive: true });
await mkdir(resolve(dist, "browser"), { recursive: true });
await mkdir(resolve(dist, "vite"), { recursive: true });
await mkdir(resolve(dist, "types"), { recursive: true });

// The proxy engines are never imported at the top level by the server/router
// code (their dist paths are injected by the host or resolved lazily via a
// createRequire shim at serve time). Marking them external is defense in depth:
// even if a transitive import crept in, esbuild would leave it as a runtime
// import rather than inlining UV's CJS lib and tripping its `require("node:…")`
// through esbuild's __require stub. A consumer that never serves engine assets
// then never needs these installed.
const engineExternals = [
  "@titaniumnetwork-dev/ultraviolet",
  "@mercuryworkshop/bare-as-module3",
  "@mercuryworkshop/bare-mux",
  "@mercuryworkshop/bare-mux/node",
  "@mercuryworkshop/scramjet",
  "@mercuryworkshop/scramjet/path",
];

await build({
  entryPoints: [resolve(__dirname, "src/client/index.ts")],
  outfile: resolve(dist, "client/index.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
});

await build({
  entryPoints: [resolve(__dirname, "src/server/index.ts")],
  outfile: resolve(dist, "server/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node19",
  external: engineExternals,
});

await build({
  entryPoints: [resolve(__dirname, "src/server/router.ts")],
  outfile: resolve(dist, "server/router.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node19",
  external: engineExternals,
});

await build({
  entryPoints: [resolve(__dirname, "src/shared/constants.ts")],
  outfile: resolve(dist, "shared/constants.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node19",
});

await build({
  entryPoints: [resolve(__dirname, "src/vite/index.ts")],
  outfile: resolve(dist, "vite/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node19",
  // Vite and Connect are provided by the consuming host project; never bundle.
  external: ["vite", "connect"],
});

await build({
  entryPoints: [resolve(__dirname, "src/browser/bootstrap.ts")],
  outfile: resolve(dist, "browser/index.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
});

for (const name of ["index", "constants", "router", "vite"]) {
  const source = await readFile(
    resolve(__dirname, `src/types/${name}.ts`),
    "utf8",
  );
  await writeFile(resolve(dist, `types/${name}.d.ts`), source);
}
