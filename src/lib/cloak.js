import { parse } from "node-html-parser";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// resolved cloak metadata is pre-fetched by scripts/fetch-cloaks.js into
// ./cloak/builtins.json at the project root. cloak.js lives at src/lib/, so go
// up two levels to reach the project root.
const builtinsFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../cloak/builtins.json",
);

/** @type {import("./cloak").AppCloak[] | undefined} */
let builtinsCache;

/**
 * Load the pre-fetched built-in cloaks from cloak/builtins.json. Cached after
 * the first read. Returns an empty array if the cache file is missing (eg. the
 * fetch-cloaks script hasn't been run yet) so callers can render gracefully.
 * @returns {Promise<import("./cloak").AppCloak[]>}
 */
export async function getBuiltinCloaks() {
  if (builtinsCache !== undefined) return builtinsCache;

  try {
    builtinsCache = JSON.parse(await readFile(builtinsFile, "utf8"));
  } catch (err) {
    console.error("Failed to load built-in cloaks:", err.message);
    builtinsCache = [];
  }

  return builtinsCache;
}

/** @type {(string | import("./cloak").AppCloak)[]} */
export const randomCloaks = [
  {
    icon: "https://ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  "about:blank",
  // LMS and educational sites:
  "https://canvas.instructure.com/",
  "https://www.khanacademy.org/",
  "https://quizlet.com/",
  "https://www.turnitin.com/",
  "https://www.coursera.org/",
  // Search engines:
  "https://search.yahoo.com/",
  "https://www.duckduckgo.com/",
  // General information and news:
  "https://www.wikipedia.org/",
  "https://www.bbc.com/news",
  "https://edition.cnn.com/",
  "https://www.nytimes.com/",
  // Tech and development:
  "https://gitlab.com/",
  "https://github.com/",
  "https://stackoverflow.com/",
  "https://developer.apple.com/",
  "https://apple.com/",
  // Productivity and utilities:
  "https://docs.google.com/",
  "https://www.trello.com/",
  "https://evernote.com/",
  "https://www.asana.com/",
  "https://www.todoist.com/",
  "https://www.surveymonkey.com/",
  "https://www.typeform.com/",
  // Social media (if allowed):
  "https://www.linkedin.com/",
  // Shopping and entertainment:
  "https://www.goodreads.com/",
  // Others (casual and school-useful):
  "https://www.weather.com/",
  "https://translate.google.com/",
  "https://maps.google.com/",
  "https://www.reddit.com/",
  "https://answers.microsoft.com/en-us",
  "https://www.medium.com/",
  "https://www.wolframalpha.com/",
];

/**
 * @returns {Promise<import("./cloak").AppCloak | undefined>}
 */
export async function getRandomCloak() {
  let retries = 5;

  while (true) {
    let cloak = randomCloaks[~~(Math.random() * randomCloaks.length)];

    try {
      if (typeof cloak === "string") cloak = await extractCloakData(cloak);
      return cloak;
    } catch (err) {
      console.error("Error fetching random cloak:", cloak, err);
    }

    retries--;
    if (retries === 0) {
      console.error("Max retries exceeded for cloak");
      break;
    }
  }
}

// parse already-fetched HTML into cloak data. `finalUrl` is the post-redirect
// URL the HTML came from (used to resolve relative icon hrefs and as the cloak
// url). shared by the live fetch path and the build-time cache generator.
/**
 * @param {string} html
 * @param {string} finalUrl
 * @returns {import("./cloak").AppCloak}
 */
export function parseCloakData(html, finalUrl) {
  const root = parse(html);

  const url = new URL(finalUrl);

  // try to find the title
  const t = root.querySelector("title");
  const title = t ? t.textContent : `${url.host}${url.pathname}${url.search}`;

  if (title.toLowerCase().includes("redirecting"))
    throw new Error(`Cloak was redirecting...`);

  // try to find a shortcut icon
  const iconSelector = root.querySelector("link[rel*='icon']");
  const href = iconSelector?.getAttribute("href");

  // fallback to /favicon.ico
  const icon =
    typeof href === "string"
      ? new URL(href, url).toString()
      : url.origin + "/favicon.ico";

  return { icon, title, url: finalUrl };
}

/**
 * @param {string} address
 * @returns {Promise<import("./cloak").AppCloak>}
 */
export async function extractCloakData(address) {
  if (address === "about:blank")
    return {
      title: "about:blank",
      icon: "",
      url: "about:blank",
    };

  const res = await fetch(address);

  if (!res.ok) throw new Error(`Cloak address gave status code ${res.status}`);

  return parseCloakData(await res.text(), res.url);
}
