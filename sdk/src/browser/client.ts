import type {
  GameLaunchMetadata,
  HUCatalogClient,
  ListData,
  ListOptions,
  TheatreEntry,
  TheatreEntryMin,
} from "../types/index.ts";

export type HURoutes = {
  queryPath: string;
  gamePath: string;
  playPath: string;
  webretroPath: string;
  assetPrefix: string;
  imagePrefix: string;
};

export const CANONICAL_API_BASE = "https://holyunb.locker/v1/games/";
export const CANONICAL_CDN_BASE = "https://holyunb.locker/cdn/";

export type HUClientOptions = {
  routes?: Partial<HURoutes>;
  apiBase?: string;
  cdnBase?: string;
  catalogUrl?: string;
  mode?: "direct" | "router";
  endpoint?: string;
  base?: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
};

declare global {
  interface Window {
    HU?: HUCatalogClient;
  }

  var HU: HUCatalogClient | undefined;
}

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

function createHUError(
  code: string,
  message: string,
  status?: number,
): Error & { code: string; status?: number } {
  return Object.assign(new Error(message), {
    name: "HUError",
    code,
    status,
  });
}

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const code = response.status === 404 ? "not_found" : "network_error";
    throw createHUError(
      code,
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : response.statusText,
      response.status,
    );
  }
  return json as T;
}

export function parseEmulatorType(type?: string): {
  isEmulator: boolean;
  core?: string;
} {
  if (!type || !type.startsWith("emulator.")) {
    return { isEmulator: false };
  }
  const core = type.slice("emulator.".length);
  return { isEmulator: true, core };
}

export function resolveLaunchMetadata(
  game: TheatreEntry | TheatreEntryMin,
  cdnBase: string = CANONICAL_CDN_BASE,
  routes?: Partial<HURoutes>,
  origin: string = typeof location !== "undefined" ? location.origin : "",
): GameLaunchMetadata {
  const entryType = (game.type ?? "embed").toLowerCase();
  const rawSrc = "src" in game && typeof game.src === "string" ? game.src : "";
  const assetPath =
    "assetPath" in game && typeof game.assetPath === "string"
      ? game.assetPath
      : undefined;
  const launchPath =
    typeof game.launchPath === "string" ? game.launchPath : undefined;

  const normalizedCdn = cdnBase.endsWith("/") ? cdnBase : `${cdnBase}/`;

  let directUrl = "";
  if (rawSrc) {
    if (rawSrc.startsWith("./")) {
      directUrl = `${normalizedCdn}${rawSrc.slice(2)}`;
    } else {
      directUrl = rawSrc;
    }
  } else if (assetPath) {
    directUrl = assetPath.startsWith("http")
      ? assetPath
      : origin
        ? new URL(assetPath, origin).toString()
        : `${normalizedCdn}${assetPath.replace(/^\/cdn\//, "")}`;
  } else if (launchPath) {
    directUrl = launchPath.startsWith("http")
      ? launchPath
      : new URL(launchPath, "https://holyunb.locker").toString();
  }

  const { isEmulator, core } = parseEmulatorType(entryType);

  if (isEmulator) {
    const romUrl = directUrl;
    const normalizedCdn = cdnBase.endsWith("/") ? cdnBase : `${cdnBase}/`;
    const webretroPath =
      routes?.webretroPath ?? `${normalizedCdn}html5/webretro/`;
    const searchParams = new URLSearchParams({
      rom: romUrl,
      core: core ?? "autodetect",
    });
    const defaultPlayerUrl = webretroPath.startsWith("http")
      ? `${webretroPath}?${searchParams.toString()}`
      : origin
        ? new URL(
            `${webretroPath}?${searchParams.toString()}`,
            origin,
          ).toString()
        : `${webretroPath}?${searchParams.toString()}`;

    return {
      type: "emulator",
      subType: entryType,
      url: romUrl,
      romUrl,
      core,
      defaultPlayerUrl,
      requiresProxy: false,
    };
  }

  if (entryType === "flash") {
    return {
      type: "flash",
      subType: "flash",
      url: directUrl,
      requiresProxy: false,
    };
  }

  if (entryType === "proxy") {
    return {
      type: "proxy",
      subType: "proxy",
      url: directUrl,
      requiresProxy: true,
    };
  }

  return {
    type: "embed",
    subType: entryType,
    url: directUrl,
    requiresProxy: false,
  };
}

export function createHUDirectClient({
  apiBase = CANONICAL_API_BASE,
  cdnBase = CANONICAL_CDN_BASE,
  categories: initialCategories = [],
  types: initialTypes = [],
  fetchFn = globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
  headers = {},
}: {
  apiBase?: string;
  cdnBase?: string;
  categories?: Array<{ id: string; name: string }>;
  types?: string[];
  fetchFn?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}): HUCatalogClient {
  const customFetch = fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (!customFetch) {
    throw createHUError(
      "fetch_unavailable",
      "Fetch API is not available in the current environment",
    );
  }

  const normalizedApiBase = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  const normalizedCdnBase = cdnBase.endsWith("/") ? cdnBase : `${cdnBase}/`;

  const categories = Object.freeze(
    initialCategories.map(({ id, name }) => Object.freeze({ id, name })),
  );
  const types = Object.freeze([...initialTypes]);

  const client: HUCatalogClient = {
    categories,
    types,

    async query(
      params: ListOptions = {},
      signal?: AbortSignal,
    ): Promise<ListData> {
      const normalized = { ...params };
      if (typeof normalized.q === "string" && normalized.search === undefined) {
        normalized.search = normalized.q;
        delete normalized.q;
      }
      const search = toQuery(normalized);
      const url = normalizedApiBase + (search === "" ? "" : "?" + search);

      const response = await customFetch(url, { signal, headers });
      const data = await readJson<ListData>(response);
      if (data && Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          if (!entry.imagePath || entry.imagePath.startsWith("/cdn/")) {
            entry.imagePath = `${normalizedCdnBase}thumbnails/${encodeURIComponent(entry.id)}.webp`;
          }
        }
      }
      return data;
    },

    async getGames(
      params: ListOptions = {},
      signal?: AbortSignal,
    ): Promise<ListData> {
      return await client.query(params, signal);
    },

    async search(text = "", signal?: AbortSignal): Promise<ListData> {
      return await client.query({ q: text }, signal);
    },

    async getGame(
      id: string,
      signal?: AbortSignal,
    ): Promise<TheatreEntry | undefined> {
      const url = new URL(encodeURIComponent(id), normalizedApiBase).toString();
      const response = await customFetch(url, { signal, headers });
      if (response.status === 404) return undefined;
      const game = await readJson<TheatreEntry>(response);
      if (game) {
        if (!game.imagePath || game.imagePath.startsWith("/cdn/")) {
          game.imagePath = `${normalizedCdnBase}thumbnails/${encodeURIComponent(game.id)}.webp`;
        }
        game.launch = resolveLaunchMetadata(game, normalizedCdnBase);
      }
      return game;
    },

    resolveLaunchMetadata(
      game: TheatreEntry | TheatreEntryMin,
    ): GameLaunchMetadata {
      return resolveLaunchMetadata(game, normalizedCdnBase);
    },

    getImageUrl(idOrToken: string): string {
      return `${normalizedCdnBase}thumbnails/${encodeURIComponent(idOrToken)}.webp`;
    },

    async countPlay(id: string): Promise<void> {
      try {
        const url = new URL(
          `${encodeURIComponent(id)}/plays`,
          "https://holyunb.locker/api/theatre/",
        ).toString();
        await customFetch(url, {
          method: "PUT",
          headers,
        });
      } catch {
        // Non-blocking telemetry
      }
    },
  };

  return client;
}

export function createHUDataClient({
  routes: initialRoutes,
  categories: initialCategories = [],
  types: initialTypes = [],
  fetchFn = globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
  origin = typeof location !== "undefined" ? location.origin : "",
}: {
  routes: HURoutes;
  categories?: Array<{ id: string; name: string }>;
  types?: string[];
  fetchFn?: typeof globalThis.fetch;
  origin?: string;
}): HUCatalogClient {
  const customFetch = fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (!customFetch) {
    throw createHUError(
      "fetch_unavailable",
      "Fetch API is not available in the current environment",
    );
  }

  const categories = Object.freeze(
    initialCategories.map(({ id, name }) => Object.freeze({ id, name })),
  );
  const types = Object.freeze([...initialTypes]);

  const client: HUCatalogClient = {
    categories,
    types,

    async query(
      params: ListOptions = {},
      signal?: AbortSignal,
    ): Promise<ListData> {
      const normalized = { ...params };
      if (typeof normalized.q === "string" && normalized.search === undefined) {
        normalized.search = normalized.q;
        delete normalized.q;
      }
      const search = toQuery(normalized);
      const queryUrl =
        initialRoutes.queryPath + (search === "" ? "" : "?" + search);
      const url =
        origin && queryUrl.startsWith("/")
          ? new URL(queryUrl, origin).toString()
          : queryUrl;

      const response = await customFetch(url, { signal });
      return await readJson<ListData>(response);
    },

    async getGames(
      params: ListOptions = {},
      signal?: AbortSignal,
    ): Promise<ListData> {
      return await client.query(params, signal);
    },

    async search(text = "", signal?: AbortSignal): Promise<ListData> {
      return await client.query({ q: text }, signal);
    },

    async getGame(
      id: string,
      signal?: AbortSignal,
    ): Promise<TheatreEntry | undefined> {
      const gameUrl = initialRoutes.gamePath;
      const url =
        origin && gameUrl.startsWith("/")
          ? new URL(gameUrl, origin).toString()
          : gameUrl;

      const response = await customFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
        signal,
      });

      if (response.status === 404) return undefined;
      const game = await readJson<TheatreEntry>(response);
      if (game) {
        game.launch = resolveLaunchMetadata(
          game,
          CANONICAL_CDN_BASE,
          initialRoutes,
          origin,
        );
      }
      return game;
    },

    resolveLaunchMetadata(
      game: TheatreEntry | TheatreEntryMin,
    ): GameLaunchMetadata {
      return resolveLaunchMetadata(
        game,
        CANONICAL_CDN_BASE,
        initialRoutes,
        origin,
      );
    },

    getImageUrl(idOrToken: string): string {
      const path = `${initialRoutes.imagePrefix}${idOrToken}.webp`;
      return origin && path.startsWith("/")
        ? new URL(path, origin).toString()
        : path;
    },

    async countPlay(id: string): Promise<void> {
      const playUrl = initialRoutes.playPath;
      const url =
        origin && playUrl.startsWith("/")
          ? new URL(playUrl, origin).toString()
          : playUrl;

      const response = await customFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok && response.status !== 404) {
        await readJson(response);
      }
    },
  };

  return client;
}

export function installHU({
  routes: initialRoutes,
  categories: initialCategories,
  types: initialTypes,
}: {
  routes: HURoutes;
  categories: Array<{ id: string; name: string }>;
  types: string[];
}) {
  const currentScript =
    typeof document !== "undefined" ? document.currentScript : null;
  const scriptSrc =
    currentScript instanceof HTMLScriptElement
      ? currentScript.src
      : typeof location !== "undefined"
        ? location.href
        : "";
  const scriptUrl = scriptSrc
    ? new URL(
        scriptSrc,
        typeof location !== "undefined" ? location.href : undefined,
      )
    : null;
  const defaultBase = scriptUrl
    ? scriptUrl.pathname.replace(/index\.js$/, "")
    : "/cdn/";
  const origin = typeof location !== "undefined" ? location.origin : "";

  const rewriteBase = (pathname: string, base: string) =>
    pathname.startsWith(defaultBase)
      ? base + pathname.slice(defaultBase.length)
      : pathname;

  const routes: HURoutes = {
    queryPath: rewriteBase(initialRoutes.queryPath, defaultBase),
    gamePath: rewriteBase(initialRoutes.gamePath, defaultBase),
    playPath: rewriteBase(initialRoutes.playPath, defaultBase),
    webretroPath: rewriteBase(initialRoutes.webretroPath, defaultBase),
    assetPrefix: rewriteBase(initialRoutes.assetPrefix, defaultBase),
    imagePrefix: rewriteBase(initialRoutes.imagePrefix, defaultBase),
  };

  const client = createHUDataClient({
    routes,
    categories: initialCategories,
    types: initialTypes,
    origin,
  });

  globalThis.HU = client;
}
