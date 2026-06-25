// Pre-fetches every built-in cloak from src/lib/cloak.ts, caches the raw HTML
// under ./cloak/html, and writes resolved { icon, title, url } metadata to
// ./cloak/builtins.json. At runtime the tab cloak settings page loads that JSON
// to render the cloak pills without doing any live fetching.
//
// Run with `npm run fetch-cloaks`.
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "node-html-parser";
import { randomCloaks } from "../src/lib/cloak.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const cloakDir = resolve(root, "cloak");
const htmlDir = resolve(cloakDir, "html");
const outFile = resolve(cloakDir, "builtins.json");

const browserHeaders = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-ch-ua":
    '"Chromium";v="126", "Google Chrome";v="126", "Not.A/Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

function parseCloakData(html, finalUrl) {
  const node = parse(html);
  const url = new URL(finalUrl);

  const t = node.querySelector("title");
  const title = t ? t.textContent : `${url.host}${url.pathname}${url.search}`;

  if (title.toLowerCase().includes("redirecting"))
    throw new Error("Cloak was redirecting...");

  const iconSelector = node.querySelector("link[rel*='icon']");
  const href = iconSelector?.getAttribute("href");
  const icon =
    typeof href === "string"
      ? new URL(href, url).toString()
      : url.origin + "/favicon.ico";

  return { icon, title, url: finalUrl };
}

function slugify(address) {
  const slug =
    address.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "blank";
  return slug.slice(0, 120);
}

await mkdir(htmlDir, { recursive: true });

const resolved = [];

for (const entry of randomCloaks) {
  // entries are either a bare URL string or an already-resolved AppCloak object
  if (typeof entry !== "string") {
    resolved.push(entry);
    console.log("Kept pre-resolved cloak:", entry.title);
    continue;
  }

  if (entry === "about:blank") {
    resolved.push({ icon: "", title: "about:blank", url: "about:blank" });
    console.log("Kept about:blank");
    continue;
  }

  try {
    const res = await fetch(entry, {
      headers: browserHeaders,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);

    const html = await res.text();
    await writeFile(resolve(htmlDir, `${slugify(res.url)}.html`), html);

    const cloak = parseCloakData(html, res.url);
    resolved.push(cloak);
    console.log("Resolved cloak:", cloak.title, "->", entry);
  } catch (err) {
    console.error("Skipping cloak (failed to fetch):", entry, err.message);
  }
}

await writeFile(outFile, JSON.stringify(resolved, null, 2));

console.log(`\nSaved ${resolved.length} cloaks to ${outFile}`);
