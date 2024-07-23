const isError = (err: unknown): err is Error =>
  typeof err === "object" && err instanceof Error;

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
  search?: string | null;
  /**
   * default is desc, unless 'search' is specified
   */
  order?: "desc" | "asc" | string | null;
  sort?: "name" | "plays" | string | null;
  limit?: number;
  offset?: number;
  limitPerCategory?: number;
  category?: string[] | null;
  ids?: string[];
}

export interface ListAPIQuery {
  search?: string;
  order?: string;
  sort?: string;
  limit?: string;
  offset?: string;
  limitPerCategory?: string;
  category?: string;
  ids?: string;
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
      if (
        typeof e === "string" ||
        typeof e === "number" ||
        (typeof e === "object" && e !== null)
      )
        result[param] = e.toString();
    }

    return result;
  }
  async fetch<JSONData>(
    url: string,
    init: RequestInit = {},
    signal?: AbortSignal,
  ) {
    const outgoing = await fetch(this.api + url, {
      ...init,
      signal,
    });

    const json = await outgoing.json();

    if (!outgoing.ok) {
      const error: Partial<JSONError<unknown>> = new Error(
        ("message" in json && (json as { message: string }).message) ||
          outgoing.statusText,
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
    return await this.fetch<ListData>(
      "?" + new URLSearchParams(this.sortParams(s)),
      undefined,
      signal,
    );
  }
}
