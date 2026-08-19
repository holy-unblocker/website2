import { theatreCategories } from "@lib/gameCategories";
import { theatreTypes } from "@lib/TheatreWrapper";
import { proxyRouteCookie } from "@lib/proxyRouteCookies.js";
import type { ListData, ListOptions, TheatreEntry } from "@lib/TheatreAPI";

export interface HUClient {
  readonly categories: ReadonlyArray<{ id: string; name: string }>;
  readonly types: ReadonlyArray<string>;
  query(params?: ListOptions, signal?: AbortSignal): Promise<ListData>;
  getGames(params?: ListOptions, signal?: AbortSignal): Promise<ListData>;
  search(text?: string, signal?: AbortSignal): Promise<ListData>;
  getGame(id: string): Promise<TheatreEntry | undefined>;
}

export interface HUBrowserClient extends HUClient {
  countPlay(id: string): Promise<void>;
  init(config?: {
    container?: string | HTMLElement;
    headless?: boolean;
    theme?: "dark" | "light" | "auto";
    columns?: number;
    rows?: number;
    gamesPerPage?: number;
    showSearch?: boolean;
    showCategories?: boolean;
    showRandom?: boolean;
    onReady?: () => void;
    onGameStart?: (game: { id: string; name: string }) => void;
    onGameEnd?: () => void;
    onError?: (error: Error & { code?: string; status?: number }) => void;
    base?: string;
  }): Promise<void>;
  getGameUrl(
    id: string,
  ): Promise<{ url: string; meta: { id: string; name: string } } | undefined>;
  getImageUrl(imageToken: string): Promise<string>;
  loadGame(id: string): Promise<void>;
  endGame(): void;
  destroy(): void;
  on(
    event: "ready" | "gameStart" | "gameEnd" | "error",
    handler: (...args: any[]) => void,
  ): void;
  off(
    event: "ready" | "gameStart" | "gameEnd" | "error",
    handler: (...args: any[]) => void,
  ): void;
}

export interface HUServerClientConfig {
  publicBase: string;
  endpoint?: string;
  cookie?: string | null;
  seed?: string | null;
}

const DEFAULT_ENDPOINT = "https://holyunb.locker/api/theatre/";

function toQuery(params: ListOptions = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      query.set(key, value.join(","));
      continue;
    }
    query.set(key, String(value));
  }

  return query.toString();
}

async function readJson<T>(response: Response) {
  if (response.status === 404) return undefined;

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof json === "object" && json !== null && "message" in json
        ? String(json.message)
        : response.statusText,
    );
  }

  return json as T;
}

export function createHUServerClient({
  publicBase,
  endpoint = DEFAULT_ENDPOINT,
  cookie,
  seed,
}: HUServerClientConfig): HUClient {
  const normalizedEndpoint = endpoint.endsWith("/") ? endpoint : endpoint + "/";
  if (!publicBase.startsWith("/") || !publicBase.endsWith("/")) {
    throw new TypeError("publicBase must start and end with '/'");
  }

  // The route seed decides how opaque /cdn/ paths and launch tokens are signed.
  // On a first visit the request carries no seed cookie yet, so forwarding the
  // raw cookie would make the upstream mint a second seed and sign tokens the
  // page itself cannot read back. Pin the seed the middleware already resolved.
  const outgoingCookie = seed
    ? [
        ...(cookie ?? "")
          .split(";")
          .map((part) => part.trim())
          .filter(
            (part) => part !== "" && !part.startsWith(`${proxyRouteCookie}=`),
          ),
        `${proxyRouteCookie}=${seed}`,
      ].join("; ")
    : cookie;

  const headers: HeadersInit | undefined = outgoingCookie
    ? { cookie: outgoingCookie }
    : undefined;

  return {
    categories: Object.freeze(
      theatreCategories.map(({ id, name }) => Object.freeze({ id, name })),
    ),
    types: Object.freeze([...theatreTypes]),
    async query(params = {}, signal) {
      const normalized = { ...params };
      if (typeof normalized.q === "string" && normalized.search === undefined) {
        normalized.search = normalized.q;
      }
      const search = toQuery(normalized);
      const response = await fetch(
        normalizedEndpoint + (search === "" ? "" : "?" + search),
        { signal, headers },
      );
      return (await readJson<ListData>(response)) as ListData;
    },
    async getGames(params = {}, signal) {
      return await this.query(params, signal);
    },
    async search(text = "", signal) {
      return await this.query({ q: text }, signal);
    },
    async getGame(id) {
      const response = await fetch(
        new URL(encodeURIComponent(id), normalizedEndpoint),
        { headers },
      );
      return await readJson<TheatreEntry>(response);
    },
  };
}

export function getHU(): HUBrowserClient {
  if (globalThis.HU === undefined) {
    throw new Error("HU is not available");
  }

  return globalThis.HU;
}
