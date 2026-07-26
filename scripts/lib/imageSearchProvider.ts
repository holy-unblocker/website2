// Image search provider abstraction (ported from bigame).
//
// Thumbnail backfill needs to look up an image by a game's name. The concrete
// search backend (Bing, Brave, etc.) is interchangeable: implement
// ImageSearchProvider and depend only on this interface, never on a specific
// vendor SDK.

export interface ImageSearchResult {
  /** the best image url to download (full-resolution preferred) */
  url: string;
  /** where the image was found (domain or page url), for auditing */
  source: string;
}

export interface ImageSearchOptions {
  /** adult-content filtering; providers map this to their own levels */
  safesearch?: "off" | "moderate" | "strict";
}

export interface ImageSearchProvider {
  /** stable identifier, eg. "brave" or "bing" */
  readonly name: string;
  /**
   * Return the single best image match for `query`, or null when there is no
   * usable result. Implementations throw on transport/auth errors so callers
   * can distinguish "no match" from "request failed".
   */
  searchOne(
    query: string,
    options?: ImageSearchOptions,
  ): Promise<ImageSearchResult | null>;
}
