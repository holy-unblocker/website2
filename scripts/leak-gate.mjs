// Leak gate: fail the build if anything a mirror serves names the proxy.
//
// Runs after scripts/estrogen-build.mjs, over the finished build:
//
// 1. `estrogen --check` over the served trees with the canary list. It reports
//    any file estrogen would still change and any canary it can see.
// 2. A static scan of every file a visitor can be served: dist/client,
//    public/, and the compiled worker and bootstrap in
//    dist/server/estrogen-private. Every file type, binary included.
// 3. A live scan: start the built server on a spare loopback port and crawl
//    it as three visitors: a new one, one who saved every setting through the
//    /settings/uv forms, and one still holding the cookies from before
//    proxyCookies.js. Each requests every page route in src/pages, follows
//    same-origin links in the HTML, and scans every body and every header,
//    Set-Cookie included. The first also requests the worker, the bootstrap
//    and every vendored engine file. The third checks that its old cookies
//    were migrated. Server-rendered HTML exists only here.
//
// The gate scans what a mirror serves. The main website (appConfig.mainWebsite)
// renders plain text for search engines by design (HolyText, HolyLink,
// robots.txt, the sitemap), so a hit in a static file is excused only when the
// live server answers that file's URL with 404 for a mirror.
//
// Each canary is searched in plain text (any case), URL-encoded and, when it is
// long enough not to occur by chance, base64 at all three byte alignments.
//
// Flags: --no-live skips step 3, so every static hit fails. --origin=URL scans
// a server that is already running instead of starting one.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readdir, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { estrogenCanaryJson, loadCanaries } from "./lib/leak-canaries.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const verbose = Boolean(process.env.LEAK_GATE_VERBOSE);

const listPath = new URL("./estrogen-canaries.json", import.meta.url);
const { allow = [] } = JSON.parse(await readFile(listPath, "utf8"));
const canaries = await loadCanaries();
const {
  decodeRelay,
  engineCookie,
  legacyRelayCookies,
  relayCookies,
  transportCookie,
} = await import("../src/lib/proxyCookies.js");

// url: the public URL prefix of a static root, or null when only a route
// serves it.
const servedRoots = [
  { dir: "dist/client", url: "/" },
  { dir: "public", url: "/" },
  { dir: "dist/server/estrogen-private", url: null },
];

const problems = [];
const fail = (message) => problems.push(message);
const notes = [];

// ---------------------------------------------------------------- forms

function base64Cores(value) {
  const bytes = Buffer.from(value, "utf8");
  const cores = new Set();
  for (let pad = 0; pad < 3; pad++) {
    const encoded = Buffer.concat([Buffer.alloc(pad), bytes]).toString(
      "base64",
    );
    // Characters fully determined by the value's bytes, whatever surrounds it.
    const start = [0, 2, 3][pad];
    const end = Math.floor(((pad + bytes.length) * 8) / 6);
    const core = encoded.slice(start, end);
    cores.add(core);
    cores.add(core.replaceAll("+", "-").replaceAll("/", "_"));
  }
  return cores;
}

function percentAll(value) {
  return [...Buffer.from(value, "utf8")]
    .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
    .join("");
}

// { needle, caseless, word, form, canary }
const needles = [];
for (const canary of canaries) {
  const lower = canary.value.toLowerCase();
  const add = (needle, form, caseless = true, word = false) =>
    needles.push({ needle, caseless, word, form, canary });
  add(lower, "plain", true, canary.word);
  const uri = encodeURIComponent(canary.value).toLowerCase();
  if (uri !== lower) add(uri, "url");
  add(percentAll(canary.value), "url-all");
  if (canary.word) continue;
  for (const variant of new Set([canary.value, lower]))
    for (const core of base64Cores(variant)) add(core, "base64", false);
}

const wordChar = /[A-Za-z0-9_]/;

function allowed(where, line, needle) {
  return allow.some(
    (rule) =>
      where.endsWith(rule.path) &&
      (!rule.words || needle.word) &&
      new RegExp(rule.line).test(line),
  );
}

function lineAt(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  let end = text.indexOf("\n", index);
  if (end === -1) end = text.length;
  return text.slice(start, end).replace(/\r$/, "");
}

// A short canary inside a long run of base64 characters is chance: VM
// bytecode and inline data are megabytes of it, and "/uv/" or "wisp" turn up
// there at random. A real path or URL breaks the run with ".", ":", a quote
// or "<" long before 40 characters. Long canaries never take this exemption.
const base64Char = /[A-Za-z0-9+/=_-]/;
const base64Run = 40;
function insideBase64(text, start, end) {
  let left = start;
  while (left > 0 && end - left < base64Run && base64Char.test(text[left - 1]))
    left -= 1;
  let right = end;
  while (
    right < text.length &&
    right - left < base64Run &&
    base64Char.test(text[right])
  )
    right += 1;
  return right - left >= base64Run;
}

let scannedFiles = 0;
let scannedBytes = 0;

// Every canary in `buffer`, one message per canary and form.
function scan(where, buffer) {
  scannedFiles += 1;
  scannedBytes += buffer.length;
  const text = buffer.toString("latin1");
  const lower = text.toLowerCase();
  const hits = [];
  for (const needle of needles) {
    const haystack = needle.caseless ? lower : text;
    let index = haystack.indexOf(needle.needle);
    while (index !== -1) {
      const end = index + needle.needle.length;
      // A word boundary only matters at an edge that is itself a word
      // character: "/uv/" is a hit in "locker/uv/", "wisp" is not in "cwisps".
      const hit =
        !needle.word ||
        ((!wordChar.test(needle.needle[0]) ||
          !wordChar.test(text[index - 1] ?? "")) &&
          (!wordChar.test(needle.needle.at(-1)) ||
            !wordChar.test(text[end] ?? "")));
      if (
        hit &&
        !(needle.word && insideBase64(text, index, end)) &&
        !allowed(where, lineAt(text, index), needle)
      ) {
        const context = text
          .slice(Math.max(0, index - 40), end + 40)
          .replace(/[^\x20-\x7e]/g, ".");
        hits.push(
          `${where}: "${needle.canary.value}" (${needle.form}, ${needle.canary.reason}) at ${index}: ${context}`,
        );
        break;
      }
      index = haystack.indexOf(needle.needle, index + 1);
    }
  }
  return hits;
}

// ---------------------------------------------------------------- 1. estrogen --check

async function estrogenCheck() {
  const require = createRequire(import.meta.url);
  const binary =
    process.env.ESTROGEN_BIN ||
    path.join(
      path.dirname(require.resolve("@sysce/estrogen/package.json")),
      "../../.bin/estrogen",
    );
  const dirs = servedRoots
    .map(({ dir }) => dir)
    .filter((dir) => dir !== "public" && existsSync(dir));
  const temp = await mkdtemp(path.join(tmpdir(), "hu-leak-gate-"));
  const canaryFile = path.join(temp, "canaries.json");
  await writeFile(canaryFile, estrogenCanaryJson(canaries));
  const output = await new Promise((resolve, reject) => {
    const child = spawn(
      existsSync(binary) ? binary : "estrogen",
      ["--check", "-v", "--canary", canaryFile, ...dirs],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (data) => (out += data));
    child.stderr.on("data", (data) => (out += data));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out }));
  });
  await rm(temp, { recursive: true, force: true });

  const files = { skipped: 0, unchanged: [], other: [] };
  const known = [];
  for (const line of output.out.split("\n")) {
    const match = /^\s+(\w+)\s+(\S+)(?:\s+\((.*)\))?$/.exec(line);
    if (match) {
      const [, status, file] = match;
      if (status === "skipped") files.skipped += 1;
      else if (status === "unchanged") files.unchanged.push(file);
      else files.other.push(`${status} ${file}`);
      continue;
    }
    if (line.trim()) known.push(line);
  }
  // estrogen 0.5.4 counts an image SVG with nothing to rewrite as
  // "unprotected" and exits nonzero on it (fixed in 0.5.5, which reports it
  // as skipped). Such a file holds no script and no text; step 2 scans it
  // like every other file. Anything else unchanged, or any file estrogen
  // would still rewrite, fails the gate.
  for (const file of files.unchanged)
    if (!file.endsWith(".svg"))
      fail(`estrogen --check: ${file} is unprotected`);
  for (const entry of files.other)
    fail(`estrogen --check: ${entry} (not processed by the build)`);
  const unexplained = known.filter(
    (line) =>
      !/^estrogen: \d+ file\(s\):/.test(line) &&
      !new RegExp(
        `^estrogen: ${files.unchanged.length} eligible file\\(s\\) (had nothing to rewrite|are unprotected)`,
      ).test(line),
  );
  for (const line of unexplained) fail(`estrogen --check: ${line}`);
  if (output.code !== 0 && !files.unchanged.length && !unexplained.length)
    fail(`estrogen --check exited ${output.code}:\n${output.out}`);
  console.log(
    `leak gate: estrogen --check exit ${output.code}, ${files.skipped} already protected or not script, ` +
      `${files.unchanged.length} image SVG(s) with nothing to protect`,
  );
}

// ---------------------------------------------------------------- 2. static

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

// Static hits wait for the live scan: { url, hits }.
const staticHits = [];

async function staticScan() {
  for (const { dir, url } of servedRoots) {
    if (!existsSync(dir)) {
      if (dir !== "public") fail(`missing served directory ${dir}`);
      continue;
    }
    for await (const file of walk(dir)) {
      const hits = scan(path.relative(root, file), await readFile(file));
      if (!hits.length) continue;
      const relative = path.relative(dir, file).split(path.sep).join("/");
      staticHits.push({ url: url && `${url}${relative}`, hits });
    }
  }
}

// ---------------------------------------------------------------- 3. live

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ["run-server.js"], {
    env: {
      ...process.env,
      HU_LISTEN_HOST: "127.0.0.1",
      HU_LISTEN_PORT: String(port),
      FORCE_COLOR: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (data) => (log += data));
  child.stderr.on("data", (data) => (log += data));
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`server exited ${child.exitCode}:\n${log}`);
    try {
      await fetch(origin, { redirect: "manual" });
      return { origin, stop: () => child.kill("SIGTERM") };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  child.kill("SIGTERM");
  throw new Error(`server did not start:\n${log}`);
}

// Page routes from src/pages, without the dynamic ones.
async function pageRoutes() {
  const routes = new Set([
    "/",
    "/404-leak-gate",
    "/register?uv",
    "/register?sj",
  ]);
  for await (const file of walk("src/pages")) {
    const relative = path.relative("src/pages", file).split(path.sep).join("/");
    if (/\[|^_/.test(relative)) continue;
    const route = `/${relative.replace(/\.(astro|ts|js|md)$/, "")}`;
    routes.add(route.replace(/\/index$/, "/"));
  }
  return routes;
}

// A minimal cookie jar: name -> value, updated from Set-Cookie.
class Jar {
  constructor(cookies = {}) {
    this.cookies = new Map(Object.entries(cookies));
  }
  header() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
  update(response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const at = pair.indexOf("=");
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      const expired = attributes.some((attribute) => {
        const [key, val = ""] = attribute.split("=");
        if (/^max-age$/i.test(key)) return Number(val) <= 0;
        if (/^expires$/i.test(key)) return Date.parse(val) <= Date.now();
        return false;
      });
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

// The Set-Cookie that expires a cookie from before proxyCookies.js has to name
// it. Only a visitor who still sends that cookie gets one.
const legacyNames = new Set(Object.values(legacyRelayCookies));
function isLegacyExpiry(line) {
  const [pair, ...attributes] = line.split(";").map((part) => part.trim());
  const [name, value] = pair.split("=");
  return (
    legacyNames.has(name) &&
    value === "" &&
    attributes.some(
      (attribute) =>
        /^expires=/i.test(attribute) &&
        Date.parse(attribute.slice(8)) <= Date.now(),
    )
  );
}

const statuses = {};
let fetched = 0;

async function request(origin, target, jar, init = {}) {
  const response = await fetch(new URL(target, origin), {
    redirect: "manual",
    ...init,
    headers: { ...(init.headers ?? {}), cookie: jar.header() },
  });
  fetched += 1;
  statuses[response.status] = (statuses[response.status] ?? 0) + 1;
  if (verbose && response.status >= 300)
    console.log(
      `leak gate: ${response.status} ${init.method ?? "GET"} ${target}`,
    );
  if (response.status >= 500)
    fail(`${init.method ?? "GET"} ${target}: HTTP ${response.status}`);
  jar.update(response);
  return response;
}

async function scanResponse(label, response) {
  const headers = [...response.headers]
    .filter(([name]) => name !== "set-cookie")
    .map(([name, value]) => `${name}: ${value}`);
  for (const line of response.headers.getSetCookie())
    if (!isLegacyExpiry(line)) headers.push(`set-cookie: ${line}`);
  const body = Buffer.from(await response.arrayBuffer());
  for (const hit of scan(`${label} (headers)`, Buffer.from(headers.join("\n"))))
    fail(hit);
  for (const hit of scan(label, body)) fail(hit);
  return body;
}

async function crawl(origin, visitor, jar, targets) {
  const queue = [...targets];
  const seen = new Set();
  while (queue.length) {
    const target = queue.shift();
    if (seen.has(target)) continue;
    seen.add(target);
    let response;
    try {
      response = await request(origin, target, jar);
    } catch (error) {
      fail(`${visitor}: GET ${target}: ${error.message}`);
      continue;
    }
    const body = await scanResponse(`${visitor}: GET ${target}`, response);
    if (!/text\/html/.test(response.headers.get("content-type") ?? ""))
      continue;
    for (const [, link] of body
      .toString("utf8")
      .matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (!link.startsWith("/") || link.startsWith("//")) continue;
      queue.push(link.replaceAll("&amp;", "&"));
    }
  }
  return seen.size;
}

// The noscript forms of /settings/uv: every setting a visitor can save there.
const settingsForms = [
  { type: "relayA", relayUrlA: "https://relay-a.invalid/r/" },
  { type: "relayB", relayUrlB: "wss://relay-b.invalid/r/" },
  { type: "proxyEngine", proxyEngine: "sj" },
  { type: "proxyMode", proxyMode: "redirect" },
  { type: "adblock", adblock: "1" },
  { type: "noscript", noscript: "1" },
];

async function liveScan(origin) {
  process.env.HU_PROXY_BUILD_FILE = path.resolve(
    "dist/server/proxy-build.json",
  );
  const { getProxyRouteMap } = await import("../src/lib/proxyRoutes.js");
  const routes = getProxyRouteMap();
  const pages = [...(await pageRoutes()), "/robots.txt"];

  // A new visitor, plus every script route: the worker, the bootstrap and
  // every vendored engine file, each of which must be served.
  const fresh = new Jar();
  const engineFiles = Object.values(routes.files);
  for (const file of engineFiles) {
    const response = await request(origin, file, fresh);
    if (response.status !== 200)
      fail(
        `GET ${file}: HTTP ${response.status}, expected a vendored engine file`,
      );
    await scanResponse(`new visitor: GET ${file}`, response);
  }
  let crawled = await crawl(origin, "new visitor", fresh, [
    ...pages,
    routes.paths.serviceWorker,
    `${routes.paths.serviceWorker}?adblock=1&noscript=1`,
    ...Object.values(routes.assets),
  ]);

  // A visitor who saved every setting, then a transport through the client
  // path (cookies.ts writes the transport cookie; no form posts it).
  const saved = new Jar();
  await request(origin, "/", saved);
  for (const form of settingsForms) {
    const response = await request(origin, "/settings/uv", saved, {
      method: "POST",
      body: new URLSearchParams(form),
    });
    await scanResponse(
      `saved settings: POST /settings/uv ${form.type}`,
      response,
    );
  }
  if (saved.cookies.get(relayCookies.bare) === undefined)
    fail("saved settings: the relayA form saved no relay cookie");
  saved.cookies.set(transportCookie, "b");
  crawled += await crawl(origin, "saved settings", saved, pages);
  // Every response re-sets these cookies; the values must survive that.
  const savedRelays = {
    [relayCookies.bare]: settingsForms[0].relayUrlA,
    [relayCookies.wisp]: settingsForms[1].relayUrlB,
  };
  for (const [name, url] of Object.entries(savedRelays))
    if (decodeRelay(saved.cookies.get(name)) !== url)
      fail(
        `saved settings: ${name} holds ${saved.cookies.get(name)} after the crawl, expected ${url}`,
      );
  if (saved.cookies.get(engineCookie) !== "2")
    fail(
      `saved settings: ${engineCookie} is ${saved.cookies.get(engineCookie)}, expected 2`,
    );
  if (saved.cookies.get(transportCookie) !== "b")
    fail(
      `saved settings: ${transportCookie} is ${saved.cookies.get(transportCookie)} after the crawl, expected b`,
    );

  // A visitor holding the cookies written before proxyCookies.js. Their
  // values must survive under the new names, and the old ones must go.
  const legacy = new Jar({
    [legacyRelayCookies.bare]: encodeURIComponent(
      "https://legacy-a.invalid/r/",
    ),
    [legacyRelayCookies.wisp]: encodeURIComponent("wss://legacy-b.invalid/r/"),
    [transportCookie]: "bare",
    [engineCookie]: "sj",
  });
  const first = await request(origin, "/", legacy);
  await scanResponse("old cookies: GET / (first visit)", first);
  const expected = {
    [relayCookies.bare]: "https://legacy-a.invalid/r/",
    [relayCookies.wisp]: "wss://legacy-b.invalid/r/",
  };
  for (const [name, url] of Object.entries(expected))
    if (decodeRelay(legacy.cookies.get(name)) !== url)
      fail(
        `old cookies: ${name} holds ${legacy.cookies.get(name)}, expected ${url}`,
      );
  for (const name of legacyNames)
    if (legacy.cookies.has(name)) fail(`old cookies: ${name} was not expired`);
  if (legacy.cookies.get(transportCookie) !== "b")
    fail(
      `old cookies: ${transportCookie} is ${legacy.cookies.get(transportCookie)}, expected b`,
    );
  if (legacy.cookies.get(engineCookie) !== "2")
    fail(
      `old cookies: ${engineCookie} is ${legacy.cookies.get(engineCookie)}, expected 2`,
    );
  crawled += await crawl(origin, "old cookies", legacy, pages);
  for (const [name, url] of Object.entries(expected))
    if (decodeRelay(legacy.cookies.get(name)) !== url)
      fail(
        `old cookies: ${name} holds ${legacy.cookies.get(name)} after the crawl, expected ${url}`,
      );

  // A static hit only counts as main-site-only when a mirror cannot get it.
  for (const { url, hits } of staticHits) {
    if (!url) {
      for (const hit of hits) fail(hit);
      continue;
    }
    const response = await request(origin, url, new Jar());
    await response.arrayBuffer();
    if (response.status === 404)
      notes.push(`${url} matches but mirrors get 404 (main website only)`);
    else
      for (const hit of hits)
        fail(`${hit} [mirror gets HTTP ${response.status}]`);
  }

  console.log(
    `leak gate: live scan of ${origin}: ${crawled + engineFiles.length} URLs over 3 visitors, ` +
      `${fetched} requests (status ${JSON.stringify(statuses)})`,
  );
}

// ----------------------------------------------------------------

await estrogenCheck();
await staticScan();

if (flag("no-live")) {
  for (const { hits } of staticHits) for (const hit of hits) fail(hit);
} else {
  const given = option("origin");
  const server = given ? { origin: given, stop() {} } : await startServer();
  try {
    await liveScan(server.origin);
  } finally {
    server.stop();
  }
}

const words = canaries.filter((canary) => canary.word).length;
console.log(
  `leak gate: ${canaries.length} canaries (${words} whole-word), ${needles.length} encoded forms, ` +
    `${scannedFiles} files and responses, ${(scannedBytes / 1e6).toFixed(1)} MB scanned`,
);
for (const note of notes) console.log(`leak gate: note: ${note}`);

if (problems.length) {
  console.error(`leak gate: FAILED, ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log("leak gate: passed, no canary in anything a mirror is served");
