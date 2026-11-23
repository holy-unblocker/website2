// Leak gate: fail the build if any served file names the proxy.
//
// Runs after scripts/estrogen-build.mjs, over the finished build:
//
// 1. `estrogen --check` over the served trees with the canary list. It reports
//    any file estrogen would still change and any canary it can see.
// 2. A static scan of every file a visitor can be served: dist/client,
//    public/, and the compiled worker and bootstrap in
//    dist/server/estrogen-private. Every file type, binary included.
// 3. A live scan: start the built server on a spare loopback port, request
//    every page route in src/pages plus the worker, the bootstrap and every
//    vendored engine file, follow same-origin links in the HTML, and scan each
//    body and its headers. Server-rendered HTML exists only here.
//
// Each canary is searched in plain text (any case), URL-encoded and, when it is
// long enough not to occur by chance, base64 at all three byte alignments.
//
// Flags: --no-live skips step 3. --origin=URL scans a server that is already
// running instead of starting one.
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

const listPath = new URL("./estrogen-canaries.json", import.meta.url);
const { allow = [] } = JSON.parse(await readFile(listPath, "utf8"));
const canaries = await loadCanaries();

const servedRoots = [
  { dir: "dist/client", url: "/" },
  { dir: "public", url: "/" },
  { dir: "dist/server/estrogen-private", url: null },
];

const problems = [];
const fail = (message) => problems.push(message);

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
  needles.push({
    needle: lower,
    caseless: true,
    word: canary.word,
    form: "plain",
    canary,
  });
  const uri = encodeURIComponent(canary.value).toLowerCase();
  if (uri !== lower)
    needles.push({
      needle: uri,
      caseless: true,
      word: false,
      form: "url",
      canary,
    });
  needles.push({
    needle: percentAll(canary.value),
    caseless: true,
    word: false,
    form: "url-all",
    canary,
  });
  if (canary.word) continue;
  for (const variant of new Set([canary.value, lower]))
    for (const core of base64Cores(variant))
      needles.push({
        needle: core,
        caseless: false,
        word: false,
        form: "base64",
        canary,
      });
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

let scannedFiles = 0;
let scannedBytes = 0;

function scan(where, buffer) {
  scannedFiles += 1;
  scannedBytes += buffer.length;
  const text = buffer.toString("latin1");
  const lower = text.toLowerCase();
  for (const needle of needles) {
    const haystack = needle.caseless ? lower : text;
    let index = haystack.indexOf(needle.needle);
    while (index !== -1) {
      const end = index + needle.needle.length;
      const hit =
        !needle.word ||
        (!wordChar.test(text[index - 1] ?? "") &&
          !wordChar.test(text[end] ?? ""));
      if (hit && !allowed(where, lineAt(text, index), needle)) {
        const context = text
          .slice(Math.max(0, index - 40), end + 40)
          .replace(/[^\x20-\x7e]/g, ".");
        fail(
          `${where}: "${needle.canary.value}" (${needle.form}, ${needle.canary.reason}) at ${index}: ${context}`,
        );
        break;
      }
      index = haystack.indexOf(needle.needle, index + 1);
    }
  }
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
  // "unprotected" and exits nonzero on it. Such a file holds no script and no
  // text; step 2 scans it like every other file. Anything else unchanged, or
  // any file estrogen would still rewrite, fails the gate.
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
  if (output.code !== 0 && files.unchanged.some((f) => !f.endsWith(".svg")))
    fail(`estrogen --check exited ${output.code}`);
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

async function staticScan() {
  for (const { dir } of servedRoots) {
    if (!existsSync(dir)) {
      if (dir !== "public") fail(`missing served directory ${dir}`);
      continue;
    }
    for await (const file of walk(dir))
      scan(path.relative(root, file), await readFile(file));
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
      return { origin, stop: () => child.kill("SIGTERM"), child };
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
    let route = `/${relative.replace(/\.(astro|ts|js|md)$/, "")}`;
    routes.add(route.replace(/\/index$/, "/"));
  }
  return routes;
}

async function liveScan(origin) {
  process.env.HU_PROXY_BUILD_FILE = path.resolve(
    "dist/server/proxy-build.json",
  );
  const { getProxyRouteMap } = await import("../src/lib/proxyRoutes.js");
  const routes = getProxyRouteMap();
  const queue = [
    ...(await pageRoutes()),
    "/robots.txt",
    "/sitemap-index.xml",
    "/sitemap-0.xml",
    routes.paths.serviceWorker,
    `${routes.paths.serviceWorker}?adblock=1`,
    ...Object.values(routes.files),
    ...Object.values(routes.assets),
  ];
  const seen = new Set();
  let cookie = "";
  let fetched = 0;
  const statuses = {};
  while (queue.length) {
    const target = queue.shift();
    if (seen.has(target)) continue;
    seen.add(target);
    let response;
    try {
      response = await fetch(new URL(target, origin), {
        redirect: "manual",
        headers: cookie ? { cookie } : {},
      });
    } catch (error) {
      fail(`GET ${target}: ${error.message}`);
      continue;
    }
    fetched += 1;
    statuses[response.status] = (statuses[response.status] ?? 0) + 1;
    if (process.env.LEAK_GATE_VERBOSE && response.status >= 300)
      console.log(`leak gate: ${response.status} ${target}`);
    if (response.status >= 500) fail(`GET ${target}: HTTP ${response.status}`);
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length && !cookie)
      cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    const headers = [...response.headers]
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n");
    const body = Buffer.from(await response.arrayBuffer());
    scan(`GET ${target} (headers)`, Buffer.from(headers));
    scan(`GET ${target}`, body);
    if (/text\/html/.test(response.headers.get("content-type") ?? "")) {
      const html = body.toString("utf8");
      for (const [, link] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
        if (!link.startsWith("/") || link.startsWith("//")) continue;
        queue.push(link.replaceAll("&amp;", "&"));
      }
    }
  }
  console.log(
    `leak gate: live scan fetched ${fetched} URLs from ${origin} (status ${JSON.stringify(statuses)})`,
  );
}

// ----------------------------------------------------------------

await estrogenCheck();
await staticScan();

if (!flag("no-live")) {
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

if (problems.length) {
  console.error(`leak gate: FAILED, ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log("leak gate: passed, no canary in any served file");
