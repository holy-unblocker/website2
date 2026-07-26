// Bing implementation of the ImageSearchProvider interface.
//
// Ported from bigame (src/lib/bingImageSearch.ts) with two changes for website2:
//   1. No cheerio dependency — the tiles are extracted with a regex, so this
//      file has no third-party imports beyond undici (already installed). One
//      less prod dependency to install on the server.
//   2. Adds searchMany(), because website2's backfill keeps the OpenAI pick
//      step: the model needs several candidates to choose between, not just
//      Bing's first hit. searchOne() is kept for interface compatibility and is
//      just "the first result of searchMany".
//
// Bing image search needs no API key: this loads the public image-search results
// page. Each result tile carries a JSON blob in the `m` attribute of an `a.iusc`
// anchor, which includes `murl` (the full-resolution image url), `purl` (the
// page the image was found on) and `t` (the tile title). We parse that rather
// than the <img> thumbnail src, since `murl` is the real source image.
//
// This is the only file that knows how Bing's markup is shaped. If Bing changes
// their HTML, update parseResults() here; nothing else needs to change.

import type {
  ImageSearchProvider,
  ImageSearchOptions,
  ImageSearchResult,
} from "./imageSearchProvider.ts";
import { getProxyDispatcher } from "./httpProxy.ts";

// Bing maps its adult filter to a cookie value; "Strict"/"Moderate"/"Off"
const SAFESEARCH_MAP: Record<
  NonNullable<ImageSearchOptions["safesearch"]>,
  string
> = {
  off: "Off",
  moderate: "Moderate",
  strict: "Strict",
};

// a desktop UA avoids the stripped-down markup Bing serves to unknown clients
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** A candidate with the extra context the OpenAI pick step reasons over. */
export interface ImageSearchCandidate extends ImageSearchResult {
  /** the tile's title text, eg. "Super Mario 64 - Box Art" */
  title: string;
}

interface BingTile {
  /** the full-resolution media url */
  murl?: string;
  /** the page the image was found on */
  purl?: string;
  /** the tile title */
  t?: string;
}

// Bing HTML-escapes the JSON inside the m="..." attribute.
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Strip Bing's <strong> highlighting etc. out of a tile title.
function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Host of a url, for compact auditing/prompting. Falls back to the raw value. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Extract candidates from a Bing image-search results page, best-first.
 * Exported for testing / for adapting if Bing's markup changes.
 */
export function parseResults(html: string, limit = 8): ImageSearchCandidate[] {
  const out: ImageSearchCandidate[] = [];
  const seen = new Set<string>();

  // each result tile is `a.iusc` with a JSON payload in its `m` attribute
  const tileRe = /<a[^>]*class="[^"]*\biusc\b[^"]*"[^>]*>/g;
  for (const [tag] of html.matchAll(tileRe)) {
    const mAttr = tag.match(/\sm="([^"]*)"/);
    if (!mAttr) continue;

    let tile: BingTile;
    try {
      tile = JSON.parse(decodeEntities(mAttr[1])) as BingTile;
    } catch {
      continue;
    }
    if (!tile.murl) continue;

    // dedupe by url; Bing repeats the same image across tiles
    if (seen.has(tile.murl)) continue;
    seen.add(tile.murl);

    out.push({
      url: tile.murl,
      source: tile.purl ? hostOf(tile.purl) : "",
      title: tile.t ? stripTags(tile.t) : "",
    });
    if (out.length >= limit) break;
  }

  return out;
}

export class BingImageSearch implements ImageSearchProvider {
  readonly name = "bing";

  /** Fetch and parse one results page, returning up to `limit` candidates. */
  async searchMany(
    query: string,
    limit = 8,
    options: ImageSearchOptions = {},
  ): Promise<ImageSearchCandidate[]> {
    const safesearch = SAFESEARCH_MAP[options.safesearch ?? "strict"];
    // qft aspect-square asks Bing for 1:1 images server-side, which is far more
    // reliable than parsing dimensions out of the result markup
    const url =
      "https://www.bing.com/images/search?q=" +
      encodeURIComponent(query) +
      "&form=HDRSC2&first=1&qft=" +
      encodeURIComponent("+filterui:aspect-square");

    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "en-US,en;q=0.9",
        // Bing reads the adult filter from this cookie
        cookie: `SRCHHPGUSR=ADLT=${safesearch}`,
      },
      // route through HTTP_PROXY/HTTPS_PROXY when configured (undici ignores an
      // undefined dispatcher); avoids blocking from a single IP on bulk runs
      dispatcher: getProxyDispatcher(),
    } as RequestInit & { dispatcher?: unknown });

    if (!res.ok)
      throw new Error(
        `bing image search failed: ${res.status} ${res.statusText}`,
      );

    return parseResults(await res.text(), limit);
  }

  async searchOne(
    query: string,
    options: ImageSearchOptions = {},
  ): Promise<ImageSearchResult | null> {
    const hits = await this.searchMany(query, 1, options);
    return hits[0] ?? null;
  }
}
