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

export interface CategoryData {
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

export default class TheatreAPI {
  private api?: string;
  private signal?: AbortSignal;
  constructor(api: string, signal?: AbortSignal) {
    this.api = api;
    this.signal = signal;
  }
  private sortParams(
    params: Record<string, string | number | boolean | undefined>
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const param in params) {
      const e = params[param];
      if (typeof e !== "undefined") result[param] = e.toString();
    }

    return result;
  }
  async fetch<JSONData>(url: string, init: RequestInit = {}) {
    const outgoing = await fetch(this.api + url, {
      ...init,
      signal: this.signal,
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
  async category(params: {
    leastGreatest?: boolean;
    sort?: string;
    category?: string;
    search?: string;
    offset?: number;
    limit?: number;
    limitPerCategory?: number;
  }) {
    return await this.fetch<CategoryData>(
      "?" + new URLSearchParams(this.sortParams(params))
    );
  }
}
