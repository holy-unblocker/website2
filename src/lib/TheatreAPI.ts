import { isError } from "@lib/isAbortError";

interface JSONError<T = unknown> extends Error {
  statusCode: number;
  json: T;
}

export const isJSONError = (err: unknown): err is JSONError =>
  isError(err) && "statusCode" in err && "json" in err;

/**
 * one of the above types or a letter/key such as A,B,TAB,SPACE,SHIFT
 */
export type KeyLike =
  | "mouseleft"
  | "mouseright"
  | "scrollup"
  | "scrolldown"
  | "wasd"
  | "arrows"
  | string;

export interface Control {
  keys: KeyLike[];
  label: string;
}

export interface TheatreEntry {
  type:
    | "emulator.nes"
    | "emulator.gba"
    | "emulator.n64"
    | "emulator.genesis"
    | "flash"
    | "embed"
    | "proxy"
    | string;
  controls: Control[];
  category: string[];
  id: string;
  name: string;
  plays: number;
  src: string;
}

export interface TheatreEntryMin {
  name: string;
  id: string;
  category: string[];
}

export interface ListData {
  total: number;
  entries: TheatreEntryMin[];
}

export interface TheatreEntry {
  type:
    | "emulator.nes"
    | "emulator.gba"
    | "emulator.n64"
    | "emulator.genesis"
    | "flash"
    | "embed"
    | "proxy"
    | string;
  controls: Control[];
  category: string[];
  id: string;
  name: string;
  plays: number;
  src: string;
}

export interface ListOptions {
  leastGreatest?: boolean;
  sort?: "name" | "plays" | "search" | string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
  limitPerCategory?: number;
  search?: string | null;
  category?: string[] | null;
  ids?: string[];
}

export default class TheatreAPI {
  private api?: string;
  constructor(api: string) {
    this.api = api;
  }
  private sortParams(params: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const param in params) {
      const e = params[param];
      if (e !== null) result[param] = e.toString();
    }

    return result;
  }
  async fetch<JSONData>(
    url: string,
    init: RequestInit = {},
    signal?: AbortSignal
  ) {
    const outgoing = await fetch(this.api + url, {
      ...init,
      signal,
    });

    const json = await outgoing.json();

    if (!outgoing.ok) {
      const error: Partial<JSONError<unknown>> = new Error(
        ("message" in json && (json as { message: string }).message) ||
          outgoing.statusText
      );
      error.statusCode = outgoing.status;
      error.json = json;
      throw error;
    }

    return json as JSONData;
  }
  async show(id: String) {
    return await this.fetch<TheatreEntry>(id + "/");
  }
  async plays(id: string) {
    return await this.fetch<TheatreEntry>(id + "/plays", {
      method: "PUT",
    });
  }
  async list(params: ListOptions, signal?: AbortSignal) {
    const s: any = { ...params };
    if (typeof params.search !== "string") delete params.search;
    if (typeof params.sort === "string") {
      switch (params.sort) {
        case "leastPopular":
          s.leastGreatest = true;
        // fallthrough
        case "mostPopular":
          s.sort = "plays";
          break;
        case "nameASC":
          s.leastGreatest = true;
        // fallthrough
        case "nameDES":
          s.sort = "name";
          break;
      }
    }
    return await this.fetch<ListData>(
      "?" + new URLSearchParams(this.sortParams(s)),
      undefined,
      signal
    );
  }
}
