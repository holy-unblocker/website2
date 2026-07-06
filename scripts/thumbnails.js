import pg from "pg";
import chalk from "chalk";
import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appConfig } from "../config/config.js";

const THUMBS = process.env.THUMBS_DIR || "/srv/theatre/public/thumbnails";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const CANDIDATES = args.candidates ? parseInt(args.candidates, 10) : 6;
const DELAY = args.delay ? parseInt(args.delay, 10) : 1200;
const DRY = !!args["dry-run"];

const braveKeys = [process.env.BRAVE_KEY1, process.env.BRAVE_KEY2].filter(
  Boolean,
);
let braveIdx = 0;

const db = new pg.Client(process.env.DATABASE_URL || appConfig.db);
const MODEL = appConfig.openai.model;
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function brave(query) {
  while (braveKeys.length) {
    const key = braveKeys[braveIdx++ % braveKeys.length];
    const res = await fetch(
      "https://api.search.brave.com/res/v1/images/search?q=" +
        encodeURIComponent(query) +
        "&count=" +
        CANDIDATES +
        "&safesearch=strict",
      { headers: { Accept: "application/json", "X-Subscription-Token": key } },
    );
    if (res.status === 402 || res.status === 429) {
      const i = braveKeys.indexOf(key);
      if (i >= 0) braveKeys.splice(i, 1);
      log(
        chalk.yellow(
          "  brave key dropped (" +
            res.status +
            "), " +
            braveKeys.length +
            " left",
        ),
      );
      if (res.status === 429) await sleep(1500);
      continue;
    }
    if (!res.ok) throw new Error("brave " + res.status);
    const data = await res.json();
    return (data.results || [])
      .map((r) => ({
        title: r.title || "",
        url:
          (r.properties && r.properties.url) ||
          (r.thumbnail && r.thumbnail.src) ||
          "",
        source: r.source || "",
      }))
      .filter((x) => x.url);
  }
  throw new Error("all brave keys exhausted");
}

function responseText(resp) {
  if (typeof resp.output_text === "string" && resp.output_text)
    return resp.output_text;
  const p = [];
  for (const it of resp.output ?? [])
    for (const c of it.content ?? [])
      if (c.type === "output_text" && typeof c.text === "string")
        p.push(c.text);
  return p.join("");
}

function parseJson(t) {
  return JSON.parse(
    t
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim(),
  );
}

async function ask(instructions, input) {
  const res = await fetch(appConfig.openai.apiBase + "/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + appConfig.openai.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ model: MODEL, stream: false, instructions, input }),
  });
  if (!res.ok)
    throw new Error(res.status + " " + (await res.text()).slice(0, 120));
  return responseText(await res.json());
}

async function pickBest(name, cands) {
  const input =
    'Game: "' +
    name +
    '". Choose the ONE search result that is the best square thumbnail / cover art / icon for THIS exact game. Reject wrong sequels, unrelated images, and screenshots of other games. ' +
    'Return {"i":<index>} or {"i":-1} if none fit.\n\n' +
    cands.map((c, i) => i + ": " + c.title + " (" + c.source + ")").join("\n");
  const raw = await ask(
    "You match games to thumbnail images. Output ONLY minified JSON.",
    input,
  );
  try {
    const d = parseJson(raw);
    const i = Number(d.i);
    return Number.isInteger(i) && i >= 0 && i < cands.length ? i : -1;
  } catch {
    return -1;
  }
}

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error("img " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

function toWebp(buf, id) {
  const tmp = join(tmpdir(), "th_" + id + "_" + process.pid);
  writeFileSync(tmp, buf);
  const out = join(THUMBS, id + ".webp");
  try {
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      "80",
      "-resize",
      "400",
      "0",
      tmp,
      "-o",
      out,
    ]);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {}
  }
  return out;
}

async function main() {
  if (!braveKeys.length) throw new Error("no BRAVE_KEY1/BRAVE_KEY2 in env");
  mkdirSync(THUMBS, { recursive: true });
  await db.connect();
  const { rows } = await db.query("SELECT id,name FROM theatre ORDER BY name");
  const todo = rows.filter((r) => !existsSync(join(THUMBS, r.id + ".webp")));
  log(chalk.bold("thumbnail backfill"));
  log(
    "  need thumbnails:",
    chalk.cyan(todo.length),
    "| dry:",
    DRY,
    "| limit:",
    LIMIT,
  );

  let done = 0,
    skip = 0,
    fail = 0,
    consec = 0;
  for (const g of todo) {
    if (done >= LIMIT) break;
    try {
      const cands = await brave(g.name + " game");
      if (!cands.length) {
        consec = 0;
        skip++;
        log(chalk.gray("  no results: " + g.name));
        await sleep(DELAY);
        continue;
      }
      const pick = await pickBest(g.name, cands);
      consec = 0;
      if (pick < 0) {
        skip++;
        log(chalk.yellow("  no good match: " + g.name));
        await sleep(DELAY);
        continue;
      }
      if (DRY) {
        done++;
        log(
          "  + " +
            g.name +
            chalk.gray(
              "  <- " + cands[pick].title + " (" + cands[pick].source + ")",
            ),
        );
        await sleep(DELAY);
        continue;
      }
      const buf = await fetchImage(cands[pick].url);
      toWebp(buf, g.id);
      done++;
      log(
        chalk.green("  [" + done + "] ") +
          g.name +
          chalk.gray("  <- " + cands[pick].source),
      );
    } catch (e) {
      fail++;
      consec++;
      log(chalk.red("  fail: " + g.name + " (" + e.message + ")"));
      if (consec >= 8) {
        log(
          chalk.red.bold(
            "aborting: 8 consecutive failures (dead key or rate limit?)",
          ),
        );
        break;
      }
    }
    await sleep(DELAY);
  }
  log(
    chalk.bold.green(
      "\ndone. added=" + done + " skipped=" + skip + " failed=" + fail,
    ),
  );
  await db.end();
}

main().catch((e) => {
  console.error(chalk.red(e.stack || e.message));
  process.exit(1);
});
