import pg from "pg";
import chalk from "chalk";
import { appConfig } from "../config/config.js";

const RAW =
  "https://raw.githubusercontent.com/x8rr/cherri-v2-leak/main/public/assets/json";

const CATALOGS = {
  truffled: { kind: "store" },
  "gn-math": { kind: "store" },
  ugs: { kind: "store" },
  ngg: { kind: "proxy" },
  apps: { kind: "proxy", appsOnly: true },
};
const DEFAULT_CATALOGS = ["truffled", "gn-math", "ugs"];

const CATEGORIES = [
  "action",
  "platformer",
  "shooter",
  "rpg",
  "sandbox",
  "survival",
  "sports",
  "puzzle",
];
const APP_CATEGORY = "app";
const FALLBACK_CATEGORY = "action";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const DRY = !!args["dry-run"];
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const BATCH = args.batch ? parseInt(args.batch, 10) : 40;
const SIM_EXISTING = args["sim-existing"]
  ? parseFloat(args["sim-existing"])
  : 0.95;
const SIM_GRAY = args["sim-gray"] ? parseFloat(args["sim-gray"]) : 0.45;
const GPT_DEDUP = !args["no-gpt-dedup"];
const CATALOG_NAMES = (
  typeof args.catalogs === "string"
    ? args.catalogs.split(",")
    : DEFAULT_CATALOGS
).map((s) => s.trim());

const db = new pg.Client(process.env.DATABASE_URL || appConfig.db);
const MODEL = appConfig.openai.model;

const log = (...a) => console.log(...a);

function norm(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function newId() {
  return Math.random().toString(36).slice(2);
}

function classify(entry, catalog) {
  const url = entry.url || "";
  const embedLink = url.match(/[?&]link=([^&]+)/);
  if (embedLink) {
    return { type: "proxy", src: decodeURIComponent(embedLink[1]) };
  }
  if (/^https?:\/\//i.test(url)) {
    return { type: "proxy", src: url };
  }
  if (CATALOGS[catalog]?.kind === "proxy") {
    return { type: "proxy", src: url };
  }
  return { type: "embed", src: url.replace(/^\/stores\//, "/api/games/") };
}

async function fetchCatalog(name) {
  const res = await fetch(`${RAW}/${name}.json`);
  if (!res.ok) throw new Error(`fetch ${name}.json -> ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) throw new Error(`${name}.json is not an array`);
  return items;
}

function responseText(resp) {
  if (typeof resp.output_text === "string" && resp.output_text) {
    return resp.output_text;
  }
  const parts = [];
  for (const item of resp.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && typeof c.text === "string")
        parts.push(c.text);
    }
  }
  return parts.join("");
}

function parseJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

async function ask(instructions, input) {
  const res = await fetch(`${appConfig.openai.apiBase}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appConfig.openai.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ model: MODEL, stream: false, instructions, input }),
  });
  if (!res.ok)
    throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return responseText(await res.json());
}

async function closestExisting(name) {
  const { rows } = await db.query(
    `SELECT name, similarity(name, $1) AS s
       FROM theatre
      WHERE name % $1
      ORDER BY s DESC
      LIMIT 1;`,
    [name],
  );
  if (!rows.length) return { match: null, sim: 0 };
  return { match: rows[0].name, sim: parseFloat(rows[0].s) };
}

async function confirmSameGame(pairs) {
  const same = new Set();
  for (let off = 0; off < pairs.length; off += BATCH) {
    const chunk = pairs.slice(off, off + BATCH);
    const input =
      "Decide if each pair refers to the SAME game (sequels/different " +
      "versions like 'Vex 3' vs 'Vex 4' are NOT the same). " +
      'Return {"pairs":[{"i":<index>,"same":true|false}]}.\n\n' +
      chunk.map((p) => `${p.i}: "${p.a}" vs "${p.b}"`).join("\n");
    try {
      const data = parseJson(
        await ask("You compare game titles. Output ONLY minified JSON.", input),
      );
      for (const r of data.pairs ?? []) if (r.same === true) same.add(r.i);
    } catch (e) {
      log(chalk.yellow(`  dedup batch failed (${e.message}); keeping as new`));
    }
  }
  return same;
}

async function tagCategories(items) {
  const out = new Map();
  for (let off = 0; off < items.length; off += BATCH) {
    const chunk = items.slice(off, off + BATCH);
    const input =
      `Assign each game exactly one category from [${CATEGORIES.join(", ")}]. ` +
      'Return {"tags":[{"i":<index>,"category":"<one of the list>"}]}.\n\n' +
      chunk.map((g) => `${g.i}: ${g.name}`).join("\n");
    let data;
    try {
      data = parseJson(
        await ask(
          "You tag browser games by genre. Output ONLY minified JSON.",
          input,
        ),
      );
    } catch (e) {
      log(chalk.yellow(`  tag batch failed (${e.message}); using fallback`));
      data = { tags: [] };
    }
    for (const t of data.tags ?? []) {
      const cat = CATEGORIES.includes(t.category)
        ? t.category
        : FALLBACK_CATEGORY;
      out.set(t.i, cat);
    }
    log(
      chalk.gray(
        `  tagged ${Math.min(off + BATCH, items.length)}/${items.length}`,
      ),
    );
  }
  return out;
}

async function main() {
  log(chalk.bold("cherri scraper"));
  log(
    `  catalogs=${CATALOG_NAMES.join(",")} dry=${DRY} limit=${LIMIT} ` +
      `sim-existing=${SIM_EXISTING} sim-gray=${SIM_GRAY} gpt-dedup=${GPT_DEDUP}`,
  );

  let raw = [];
  for (const name of CATALOG_NAMES) {
    if (!CATALOGS[name]) {
      log(chalk.yellow(`  unknown catalog "${name}", skipping`));
      continue;
    }
    const items = await fetchCatalog(name);
    for (const e of items) {
      if (!e || typeof e.name !== "string" || !e.name.trim()) continue;
      const { type, src } = classify(e, name);
      raw.push({
        name: e.name.trim(),
        type,
        src,
        appsOnly: !!CATALOGS[name].appsOnly,
      });
    }
    log(chalk.gray(`  ${name}: ${items.length} entries`));
  }
  log(`  fetched ${chalk.cyan(raw.length)} total entries`);

  const seen = new Map();
  let dupInBatch = 0;
  for (const g of raw) {
    const key = norm(g.name);
    if (!key) continue;
    if (seen.has(key)) {
      dupInBatch++;
      continue;
    }
    seen.set(key, g);
  }
  let candidates = [...seen.values()];
  log(
    `  removed ${chalk.yellow(dupInBatch)} in-batch duplicates -> ${candidates.length} unique`,
  );

  if (candidates.length > LIMIT) {
    candidates = candidates.slice(0, LIMIT);
    log(chalk.gray(`  limited to ${candidates.length}`));
  }

  await db.connect();

  const fresh = [];
  const gray = [];
  let autoSkip = 0;
  for (let i = 0; i < candidates.length; i++) {
    const g = candidates[i];
    const { match, sim } = await closestExisting(g.name);
    if (sim >= SIM_EXISTING) {
      autoSkip++;
    } else if (sim >= SIM_GRAY && match) {
      gray.push({ g, match });
    } else {
      fresh.push(g);
    }
    if ((i + 1) % 100 === 0)
      log(chalk.gray(`  checked ${i + 1}/${candidates.length}`));
  }
  log(
    `  vs existing: ${chalk.green(fresh.length)} new, ${chalk.yellow(autoSkip)} ` +
      `already present, ${chalk.blue(gray.length)} gray-zone`,
  );

  if (gray.length) {
    if (GPT_DEDUP) {
      const pairs = gray.map((x, i) => ({ i, a: x.g.name, b: x.match }));
      const same = await confirmSameGame(pairs);
      gray.forEach((x, i) => {
        if (same.has(i)) autoSkip++;
        else fresh.push(x.g);
      });
      log(
        `  gray resolved: ${chalk.yellow(same.size)} dupes, ${gray.length - same.size} new`,
      );
    } else {
      for (const x of gray) fresh.push(x.g);
    }
  }

  if (!fresh.length) {
    log(chalk.bold("nothing new to import."));
    await db.end();
    return;
  }

  const needTag = fresh
    .filter((g) => !g.appsOnly)
    .map((g, i) => ({ i, name: g.name, g }));
  const tags = await tagCategories(needTag.map(({ i, name }) => ({ i, name })));
  for (const { i, g } of needTag) g.category = tags.get(i) || FALLBACK_CATEGORY;
  for (const g of fresh) if (g.appsOnly) g.category = APP_CATEGORY;

  log(
    chalk.bold(`\nimporting ${fresh.length} games` + (DRY ? " (dry-run)" : "")),
  );
  let inserted = 0;
  for (const g of fresh) {
    if (DRY) {
      log(`  + [${g.category}/${g.type}] ${g.name}  ${chalk.gray(g.src)}`);
      continue;
    }
    await db.query(
      `INSERT INTO theatre(id, name, type, category, src, plays, controls, hidden)
       VALUES ($1, $2, $3, $4, $5, 0, '[]', false);`,
      [newId(), g.name, g.type, g.category, g.src],
    );
    inserted++;
    if (inserted % 50 === 0)
      log(chalk.gray(`  inserted ${inserted}/${fresh.length}`));
  }

  log(
    chalk.bold.green(
      DRY
        ? `\ndry-run complete: ${fresh.length} would be imported`
        : `\ndone: ${inserted} imported, ${autoSkip} skipped as duplicates`,
    ),
  );
  await db.end();
}

main().catch((e) => {
  console.error(chalk.red(e.stack || e.message));
  process.exit(1);
});
