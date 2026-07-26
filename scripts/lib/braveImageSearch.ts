// Brave implementation of the ImageSearchProvider interface.
//
// This is the only file that knows about the brave-search SDK. To swap in a
// different backend (eg. Bing), add a sibling implementation and register it in
// imageSearch.ts; nothing else in the codebase needs to change.
import { BraveSearch } from "brave-search";

import type {
  ImageSearchProvider,
  ImageSearchOptions,
  ImageSearchResult,
} from "./imageSearchProvider.ts";

export class BraveImageSearch implements ImageSearchProvider {
  readonly name = "brave";
  private client: BraveSearch;

  constructor(apiKey: string) {
    this.client = new BraveSearch(apiKey);
  }

  async searchOne(
    query: string,
    options: ImageSearchOptions = {},
  ): Promise<ImageSearchResult | null> {
    const response = await this.client.imageSearch(query, {
      count: 1,
      // the SafeSearchLevel enum isn't exported from the package root; the API
      // wants the plain string value, so cast to satisfy the typed options
      safesearch: (options.safesearch ?? "strict") as never,
    });

    const top = response.results?.[0];
    if (!top) return null;

    const url = top.properties?.url || top.thumbnail?.src;
    if (!url) return null;

    return { url, source: top.source || top.url || "" };
  }
}
