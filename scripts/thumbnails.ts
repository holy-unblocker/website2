// Thumbnail backfill for theatre games missing a thumbnails/<id>.webp file.
//
// Half the catalog (all the UGS games) shipped without thumbnails; this fills
// them in. Per game the pipeline is:
//
//   Bing image search (keyless, aspect-square)  -> up to N candidates
//     -> OpenAI picks the best square cover art  (rejects wrong sequels /
//        unrelated images / screenshots of other games)
//     -> download the chosen image
//     -> normalize to a uniform square webp with sharp
//
// The OpenAI step is required, but the pipeline degrades gracefully so one bad
// game never aborts the run: a failed download falls back to the next
// candidate, and a run only aborts after many *consecutive* hard failures
// (a sign Bing or the LLM is blocking/down, not just one unlucky game).
//
// Run with tsx (see README / the deploy notes):
//   npx tsx scripts/thumbnails.ts --dry-run            # no writes, no image downloads
//   npx tsx scripts/thumbnails.ts --limit=5            # do 5, to smoke-test
//   npx tsx scripts/thumbnails.ts                      # full backfill
//
// Config is read from config/config.js, but every value can be overridden by an
// env var so the production config.js never has to change:
//   DATABASE_URL, THEATRE_FILES_PATH (or THUMBS_DIR),
//   OPENAI_API_BASE, OPENAI_API_KEY, OPENAI_MODEL
// Optional: HTTP_PROXY / HTTPS_PROXY route outbound requests through a proxy.

import pg from "pg";
import chalk from "chalk";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { appConfig } from "../config/config.js";
import {
  BingImageSearch,
  type ImageSearchCandidate,
} from "./lib/bingImageSearch.ts";
import { getProxyDispatcher, httpProxyUrl } from "./lib/httpProxy.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ----------------------------------------------------------------------------
// args
// ----------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
) as Record<string, string | boolean>;

const LIMIT = args.limit ? parseInt(args.limit as string, 10) : Infinity;
const CANDIDATES = args.candidates
  ? parseInt(args.candidates as string, 10)
  : 8;
const DELAY = args.delay ? parseInt(args.delay as string, 10) : 800;
const SIZE = args.size ? parseInt(args.size as string, 10) : 400;
const MAX_CONSEC = args["max-consec"]
  ? parseInt(args["max-consec"] as string, 10)
  : 8;
const DRY = !!args["dry-run"];

// ----------------------------------------------------------------------------
// config (env overrides config.js so prod config need not change)
// ----------------------------------------------------------------------------
const dbUrl =
  process.env.DATABASE_URL ||
  (typeof appConfig.db === "string" ? appConfig.db : undefined);

const filesPath =
  process.env.THEATRE_FILES_PATH || appConfig.theatre?.filesPath;

const THUMBS =
  process.env.THUMBS_DIR ||
  (filesPath ? join(resolve(projectRoot, filesPath), "thumbnails") : undefined);

const oai = (appConfig as { openai?: Record<string, string> }).openai;
const OPENAI_BASE = process.env.OPENAI_API_BASE || oai?.apiBase;
const OPENAI_KEY = process.env.OPENAI_API_KEY || oai?.apiKey;
const OPENAI_MODEL = process.env.OPENAI_MODEL || oai?.model || "gpt-5.4-mini";
const OPENAI_MESSAGES = OPENAI_BASE
  ? OPENAI_BASE.replace(/\/+$/, "") + "/messages"
  : undefined;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const log = (...a: unknown[]) => console.log(...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const bing = new BingImageSearch();

// ----------------------------------------------------------------------------
// OpenAI pick step
//
// The endpoint is an OpenAI-compatible gateway that speaks the Anthropic
// /v1/messages schema and (buggily) force-streams SSE, wrapping the real
// upstream JSON as an escaped string inside a `partial_stream_error`
// text_delta. extractIndex() peels that apart with layered fallbacks, ending in
// a regex for {"i":N} over the raw body so a cosmetic streaming glitch never
// costs us the answer.
// ----------------------------------------------------------------------------
async function askMessages(system: string, user: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(
      OPENAI_MESSAGES as string,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + OPENAI_KEY,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 64,
          stream: false,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: ctrl.signal,
        dispatcher: getProxyDispatcher(),
      } as RequestInit & { dispatcher?: unknown },
    );
    // this gateway returns HTTP 200 even for errors, so we can't rely on res.ok;
    // extractIndex() validates the body instead.
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// Pull the assistant's text out of this gateway's messy SSE envelope.
function extractAnswer(body: string): string {
  let streamed = "";
  let sawSSE = false;
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^data:\s*(.*)$/);
    if (!m) continue;
    sawSSE = true;
    const payload = m[1].trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const evt = JSON.parse(payload);
      if (evt?.delta?.text) streamed += evt.delta.text;
      else if (evt?.content_block?.text) streamed += evt.content_block.text;
      else if (Array.isArray(evt?.content))
        streamed += evt.content
          .map((c: { text?: string }) => c?.text ?? "")
          .join("");
    } catch {
      /* ignore non-JSON data lines */
    }
  }
  let text = sawSSE ? streamed : body;

  // unwrap "partial_stream_error: incomplete SSE event: \"<escaped upstream>\""
  const wrap = text.indexOf("partial_stream_error");
  if (wrap !== -1) {
    const q = text.indexOf('"', wrap);
    const end = text.lastIndexOf('"');
    if (q !== -1 && end > q) {
      try {
        const upstream = JSON.parse(JSON.parse(text.slice(q, end + 1)));
        if (Array.isArray(upstream?.content))
          text = upstream.content
            .map((c: { text?: string }) => c?.text ?? "")
            .join("");
      } catch {
        /* fall through to regex */
      }
    }
  }
  return text.trim();
}

// Returns the chosen candidate index, -1 for "none fit", or null if the answer
// could not be parsed at all (treated as an LLM failure by the caller).
function extractIndex(body: string): number | null {
  const answer = extractAnswer(body);
  try {
    const cleaned = answer
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const d = JSON.parse(cleaned);
    if (Number.isInteger(Number(d.i))) return Number(d.i);
  } catch {
    /* fall through */
  }
  const matches = [...body.matchAll(/"i"\s*:\s*(-?\d+)/g)];
  if (matches.length) return Number(matches[matches.length - 1][1]);
  return null;
}

// Ask the model to choose the best candidate. Retries a few times on transport
// errors; throws only if every attempt fails (so the caller counts it as a hard
// failure rather than silently placing an unvetted image).
async function pickBest(
  name: string,
  cands: ImageSearchCandidate[],
): Promise<number> {
  const user =
    'Game: "' +
    name +
    '". Choose the ONE search result that is the best square thumbnail / cover ' +
    "art / icon for THIS exact game. Reject wrong sequels, unrelated images, " +
    'and screenshots of other games. Return {"i":<index>} or {"i":-1} if none ' +
    "fit.\n\n" +
    cands.map((c, i) => `${i}: ${c.title} (${c.source})`).join("\n");

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await askMessages(
        "You match games to thumbnail images. Output ONLY minified JSON.",
        user,
      );
      const i = extractIndex(raw);
      if (i === null) throw new Error("unparseable LLM response");
      return Number.isInteger(i) && i >= 0 && i < cands.length ? i : -1;
    } catch (e) {
      lastErr = e;
      await sleep(600 * (attempt + 1));
    }
  }
  throw new Error("LLM pick failed: " + (lastErr as Error)?.message);
}

// ----------------------------------------------------------------------------
// download + convert
// ----------------------------------------------------------------------------
async function fetchImage(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: ctrl.signal,
      dispatcher: getProxyDispatcher(),
    } as RequestInit & { dispatcher?: unknown });
    if (!res.ok) throw new Error("img " + res.status);
    const ab = await res.arrayBuffer();
    // guard against tiny error pages / 1px trackers masquerading as images
    if (ab.byteLength < 512)
      throw new Error("img too small (" + ab.byteLength + "b)");
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}

async function toWebp(buf: Buffer, id: string): Promise<void> {
  const dest = join(THUMBS as string, id + ".webp");
  await mkdir(dirname(dest), { recursive: true });
  await sharp(buf)
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toFile(dest);
}

// Try the model's pick first, then the remaining candidates (all aspect-square
// hits for the same query) until one downloads + converts. Returns the index
// actually used, or -1 if none worked.
async function placeThumbnail(
  id: string,
  cands: ImageSearchCandidate[],
  pick: number,
): Promise<number> {
  const order = [pick, ...cands.map((_, i) => i).filter((i) => i !== pick)];
  let tried = 0;
  for (const i of order) {
    if (tried >= 3) break; // don't hammer many dead urls per game
    tried++;
    try {
      const buf = await fetchImage(cands[i].url);
      await toWebp(buf, id);
      return i;
    } catch {
      /* try the next candidate */
    }
  }
  return -1;
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
async function main() {
  // fail fast on missing prerequisites, with actionable messages
  if (!dbUrl) throw new Error("no DATABASE_URL / appConfig.db");
  if (!THUMBS)
    throw new Error(
      "no THUMBS_DIR / THEATRE_FILES_PATH / appConfig.theatre.filesPath",
    );
  if (!OPENAI_MESSAGES || !OPENAI_KEY)
    throw new Error(
      "OpenAI is required: set OPENAI_API_BASE + OPENAI_API_KEY (and OPENAI_MODEL)",
    );

  await mkdir(THUMBS, { recursive: true });
  const db = new pg.Client(dbUrl);
  await db.connect();
  const { rows } = await db.query<{ id: string; name: string }>(
    "SELECT id, name FROM theatre ORDER BY name",
  );
  const todo = rows.filter((r) => !existsSync(join(THUMBS, r.id + ".webp")));

  log(chalk.bold("thumbnail backfill (bing + openai)"));
  log(
    "  thumbs:",
    chalk.gray(THUMBS),
    "\n  model:",
    chalk.gray(OPENAI_MODEL),
    "| candidates:",
    CANDIDATES,
    "| size:",
    SIZE,
    "| delay:",
    DELAY + "ms",
    "| proxy:",
    httpProxyUrl ? chalk.gray(httpProxyUrl) : "none",
  );
  log(
    "  total games:",
    chalk.cyan(rows.length),
    "| missing thumbnails:",
    chalk.cyan(todo.length),
    "| dry:",
    DRY,
    "| limit:",
    LIMIT === Infinity ? "all" : LIMIT,
  );

  let done = 0;
  let skip = 0;
  let fail = 0;
  let consec = 0;
  let processed = 0;

  for (const g of todo) {
    if (done >= LIMIT) break;
    processed++;
    try {
      const cands = await bing.searchMany(g.name + " game", CANDIDATES);
      if (!cands.length) {
        consec = 0;
        skip++;
        log(chalk.gray("  no results: " + g.name));
        await sleep(DELAY);
        continue;
      }

      const pick = await pickBest(g.name, cands);
      if (pick < 0) {
        consec = 0;
        skip++;
        log(chalk.yellow("  no good match: " + g.name));
        await sleep(DELAY);
        continue;
      }

      if (DRY) {
        consec = 0;
        done++;
        log(
          "  + " +
            g.name +
            chalk.gray(
              `  <- [${pick}] ${cands[pick].title} (${cands[pick].source})`,
            ),
        );
        await sleep(DELAY);
        continue;
      }

      const used = await placeThumbnail(g.id, cands, pick);
      if (used < 0) {
        fail++;
        consec++;
        log(chalk.red("  download failed (all candidates): " + g.name));
      } else {
        done++;
        consec = 0;
        const note =
          used === pick
            ? cands[used].source
            : `${cands[used].source} (fallback)`;
        log(chalk.green(`  [${done}] `) + g.name + chalk.gray("  <- " + note));
      }
    } catch (e) {
      fail++;
      consec++;
      log(chalk.red("  fail: " + g.name + " (" + (e as Error).message + ")"));
      if (consec >= MAX_CONSEC) {
        log(
          chalk.red.bold(
            `\naborting: ${MAX_CONSEC} consecutive failures (Bing or LLM blocking/down?)`,
          ),
        );
        break;
      }
    }
    await sleep(DELAY);
  }

  log(
    chalk.bold.green(
      `\ndone. processed=${processed} added=${done} skipped=${skip} failed=${fail}`,
    ),
  );
  await db.end();
}

main().catch((e) => {
  console.error(chalk.red((e as Error).stack || (e as Error).message));
  process.exit(1);
});
