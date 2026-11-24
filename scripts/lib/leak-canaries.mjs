// The canary list: every string that must never appear in a served file.
//
// scripts/estrogen-canaries.json holds the hand-picked entries, each with the
// source it came from. This module adds what the source already enumerates, so
// the list cannot fall behind it: the proxy globals the build renames
// (proxyRoutes.js) and every vendored engine path and file name.
import { readFile } from "node:fs/promises";

const listPath = new URL("../estrogen-canaries.json", import.meta.url);

// Shorter values only count as a whole word: a short string turns up by chance
// in megabytes of VM bytecode.
const minSubstring = 6;

export async function loadCanaries() {
  const list = JSON.parse(await readFile(listPath, "utf8"));
  const { getVendorAssetRegistry, proxyGlobalNames } =
    await import("../../src/lib/proxyRoutes.js");

  const canaries = new Map();
  const add = (value, reason, word = false) => {
    if (!value) return;
    const key = value.toLowerCase();
    const existing = canaries.get(key);
    if (existing) {
      existing.word &&= word || value.length < minSubstring;
      return;
    }
    canaries.set(key, {
      value,
      reason,
      word: word || value.length < minSubstring,
    });
  };

  for (const { value, reason } of list.canaries) add(value, reason);
  for (const { value, reason } of list.words) add(value, reason, true);

  for (const name of proxyGlobalNames()) {
    // The bare-mux entry is a regex; its literal parts are listed above.
    if (/[()[\]?*+\\|]/.test(name.replace(/\$/g, ""))) continue;
    add(name, "proxy global renamed per build (proxyRoutes.js)");
  }

  for (const publicPath of getVendorAssetRegistry().keys()) {
    add(publicPath, "canonical vendored engine path (proxyRoutes.js)");
    const base = publicPath.slice(publicPath.lastIndexOf("/") + 1);
    if (/^(?:uv\.|scramjet|controller[.-])/.test(base))
      add(base, "vendored engine file name");
  }
  for (const base of new Set(
    [...getVendorAssetRegistry().values()].map((asset) => asset.publicBase),
  ))
    add(base, "vendored engine route base (proxyRoutes.js)");

  return [...canaries.values()];
}

// The JSON estrogen reads. A word canary is not a substring scan: estrogen
// redraws a generated identifier whose parts equal it, and leaves bytecode
// alone. Omitting the flag keeps the old substring scan.
export function estrogenCanaryJson(canaries) {
  return JSON.stringify({
    canaries: canaries.map(({ value, reason, word }) =>
      word ? { value, reason, word: true } : { value, reason },
    ),
  });
}
