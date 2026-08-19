import type {
  HUBrowserClient,
  HUProxyConfig,
  HUProxyResolveRequest,
  ListData,
  ListOptions,
  TheatreEntry,
} from "../types/index.ts";

type HUEvent = "ready" | "gameStart" | "gameEnd" | "error";

type HUError = Error & {
  code?: string;
  status?: number;
};

type HUConfig = {
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
  onError?: (error: HUError) => void;
  base?: string;
  proxy?: HUProxyConfig;
};

type HURoutes = {
  queryPath: string;
  gamePath: string;
  playPath: string;
  webretroPath: string;
  assetPrefix: string;
  imagePrefix: string;
};

type HUProxyRequestMessage = {
  source: "hu:proxy-player";
  type: "resolve_proxy_url";
  requestId: string;
  targetUrl: string;
  game: {
    id: string;
    name: string;
    type?: string;
  };
};

type HUProxyResponseMessage = {
  source: "hu:proxy-player";
  type: "resolve_proxy_url_result";
  requestId: string;
  url?: string;
  error?: string;
  code?: string;
};

declare global {
  interface Window {
    HU?: HUBrowserClient;
  }

  var HU: HUBrowserClient | undefined;
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
): HUError {
  return Object.assign(new Error(message), {
    name: "HUError",
    code,
    status,
  });
}

function normalizeError(error: unknown, fallbackCode = "network_error") {
  if (error && typeof error === "object" && "code" in error) {
    return error as HUError;
  }
  const candidate = error as { status?: number } | undefined;
  return createHUError(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
    typeof candidate?.status === "number" ? candidate.status : undefined,
  );
}

async function readJson<T>(response: Response) {
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

export function installHU({
  routes: initialRoutes,
  categories: initialCategories,
  types: initialTypes,
}: {
  routes: HURoutes;
  categories: Array<{ id: string; name: string }>;
  types: string[];
}) {
  const currentScript = document.currentScript;
  const scriptSrc =
    currentScript instanceof HTMLScriptElement
      ? currentScript.src
      : location.href;
  const scriptUrl = new URL(scriptSrc, location.href);
  const defaultBase = scriptUrl.pathname.replace(/index\.js$/, "");
  const categories = Object.freeze(
    initialCategories.map(({ id, name }) => Object.freeze({ id, name })),
  );
  const types = Object.freeze([...initialTypes]);
  const listeners = new Map<HUEvent, Set<(...args: any[]) => void>>();

  const state: {
    config: HUConfig | null;
    container: HTMLElement | null;
    overlay: HTMLDivElement | null;
    iframe: HTMLIFrameElement | null;
    routes: HURoutes;
    objectUrls: Map<string, string>;
    proxyMessageHandler: ((event: MessageEvent) => void) | null;
  } = {
    config: null,
    container: null,
    overlay: null,
    iframe: null,
    routes: initialRoutes,
    objectUrls: new Map(),
    proxyMessageHandler: null,
  };

  const rewriteBase = (pathname: string, base: string) =>
    pathname.startsWith(defaultBase)
      ? base + pathname.slice(defaultBase.length)
      : pathname;

  const createRoutes = (base: string): HURoutes => ({
    queryPath: rewriteBase(initialRoutes.queryPath, base),
    gamePath: rewriteBase(initialRoutes.gamePath, base),
    playPath: rewriteBase(initialRoutes.playPath, base),
    webretroPath: rewriteBase(initialRoutes.webretroPath, base),
    assetPrefix: rewriteBase(initialRoutes.assetPrefix, base),
    imagePrefix: rewriteBase(initialRoutes.imagePrefix, base),
  });

  const resolveBase = (input?: string | null) => {
    if (input === undefined || input === null || input === "")
      return defaultBase;
    const resolved = new URL(input, location.href);
    if (resolved.origin !== location.origin) {
      throw createHUError("invalid_base", "base must be same-origin", 400);
    }
    if (
      !resolved.pathname.startsWith("/") ||
      !resolved.pathname.endsWith("/")
    ) {
      throw createHUError(
        "invalid_base",
        "base must start and end with '/'",
        400,
      );
    }
    if (resolved.pathname.includes("..")) {
      throw createHUError(
        "invalid_base",
        "base must not contain traversal",
        400,
      );
    }
    return resolved.pathname;
  };

  const emit = (event: HUEvent, payload?: unknown) => {
    const callbackName =
      event === "ready"
        ? "onReady"
        : event === "gameStart"
          ? "onGameStart"
          : event === "gameEnd"
            ? "onGameEnd"
            : "onError";
    const callback = state.config?.[callbackName];
    if (typeof callback === "function") {
      try {
        callback(payload as never);
      } catch (error) {
        console.error(error);
      }
    }
    for (const handler of listeners.get(event) ?? []) {
      try {
        handler(payload);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const on = (event: HUEvent, handler: (...args: any[]) => void) => {
    const set = listeners.get(event) ?? new Set();
    set.add(handler);
    listeners.set(event, set);
  };

  const off = (event: HUEvent, handler: (...args: any[]) => void) => {
    listeners.get(event)?.delete(handler);
  };

  const ensureContainer = (
    container?: string | HTMLElement,
  ): HTMLElement | null => {
    if (typeof container === "string") {
      const element = document.querySelector(container);
      return element instanceof HTMLElement ? element : null;
    }
    return container instanceof HTMLElement ? container : null;
  };

  const resolveProxyUrl = async (request: HUProxyResolveRequest) => {
    const resolver = state.config?.proxy?.resolveUrl;
    if (typeof resolver !== "function") {
      throw createHUError(
        "proxy_not_configured",
        "proxy.resolveUrl must be configured for proxy games",
        400,
      );
    }
    const value = await resolver(request);
    if (typeof value !== "string" || value === "") {
      throw createHUError(
        "invalid_proxy_url",
        "proxy.resolveUrl must return a non-empty string",
        400,
      );
    }
    const resolved = new URL(value, location.href);
    if (resolved.origin !== location.origin) {
      throw createHUError(
        "invalid_proxy_url",
        "proxy.resolveUrl must return a same-origin URL",
        400,
      );
    }
    return resolved.toString();
  };

  const resolveGameSourceUrl = (game: TheatreEntry) => {
    if (typeof game.src !== "string" || game.src === "") {
      throw createHUError("game_unavailable", "Game source unavailable", 404);
    }
    if (!game.src.startsWith("./")) {
      return game.src;
    }
    if (typeof game.assetPath !== "string" || game.assetPath === "") {
      throw createHUError(
        "game_unavailable",
        "Game asset path unavailable",
        404,
      );
    }
    const assetPath =
      game.src.endsWith("/") && !game.assetPath.endsWith("/")
        ? game.assetPath + "/"
        : game.assetPath;
    return new URL(assetPath, location.origin).toString();
  };

  const resolveGameLaunchUrl = async (game: TheatreEntry) => {
    const sourceUrl = resolveGameSourceUrl(game);

    if (game.type === "proxy") {
      return await resolveProxyUrl({
        targetUrl: sourceUrl,
        game: { id: game.id, name: game.name, type: game.type },
      });
    }

    if (typeof game.type === "string" && game.type.startsWith("emulator")) {
      if (typeof game.playerPath !== "string" || game.playerPath === "") {
        throw createHUError(
          "game_unavailable",
          "Emulator player unavailable",
          404,
        );
      }
      return (
        game.playerPath +
        "?" +
        new URLSearchParams({
          rom: sourceUrl,
          core: "autodetect",
        })
      );
    }

    return sourceUrl;
  };

  const handleProxyMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin) return;
    const data = event.data as Partial<HUProxyRequestMessage> | undefined;
    if (
      !data ||
      data.source !== "hu:proxy-player" ||
      data.type !== "resolve_proxy_url"
    ) {
      return;
    }
    const { requestId, targetUrl, game } = data;
    if (
      typeof requestId !== "string" ||
      typeof targetUrl !== "string" ||
      !game ||
      typeof game !== "object" ||
      typeof game.id !== "string" ||
      typeof game.name !== "string"
    ) {
      return;
    }
    const source = event.source;
    if (!source || typeof (source as WindowProxy).postMessage !== "function")
      return;

    void Promise.resolve()
      .then(async () => {
        const url = await resolveProxyUrl({
          targetUrl,
          game: {
            id: game.id,
            name: game.name,
            type: typeof game.type === "string" ? game.type : undefined,
          },
        });
        const response: HUProxyResponseMessage = {
          source: "hu:proxy-player",
          type: "resolve_proxy_url_result",
          requestId,
          url,
        };
        (source as WindowProxy).postMessage(response, location.origin);
      })
      .catch((error) => {
        const normalized = normalizeError(error, "invalid_proxy_url");
        const response: HUProxyResponseMessage = {
          source: "hu:proxy-player",
          type: "resolve_proxy_url_result",
          requestId,
          error: normalized.message,
          code: normalized.code,
        };
        (source as WindowProxy).postMessage(response, location.origin);
      });
  };

  state.proxyMessageHandler = handleProxyMessage;
  window.addEventListener("message", handleProxyMessage);

  const renderGames = (page: ListData) => {
    if (!(state.container instanceof HTMLElement)) return;
    state.container.innerHTML = "";
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
    grid.style.gap = "16px";
    for (const game of page.games ?? page.entries ?? []) {
      const item = document.createElement("a");
      item.href = game.launchPath ?? "#";
      item.style.textDecoration = "none";
      item.style.color = "inherit";
      if (typeof game.id === "string") {
        item.addEventListener("click", (event) => {
          event.preventDefault();
          void api.loadGame(game.id);
        });
      }
      const img = document.createElement("img");
      img.src = game.imagePath ?? "";
      img.alt = "";
      img.style.width = "100%";
      img.style.aspectRatio = "1 / 1";
      img.style.objectFit = "cover";
      img.style.borderRadius = "10px";
      const label = document.createElement("div");
      label.textContent = game.name;
      label.style.marginTop = "8px";
      label.style.fontSize = "14px";
      item.append(img, label);
      grid.append(item);
    }
    state.container.append(grid);
  };

  const renderGrid = async () => {
    if (!(state.container instanceof HTMLElement)) return;
    const config = state.config ?? {};
    const limit =
      Number.isInteger(config.gamesPerPage) && (config.gamesPerPage ?? 0) > 0
        ? (config.gamesPerPage as number)
        : Math.max((config.columns ?? 8) * (config.rows ?? 3), 1);
    const page = await api.query({ sort: "popular", limit });
    renderGames(page);
  };

  const ensureOverlay = () => {
    if (state.overlay) return state.overlay;
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,.88)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const iframe = document.createElement("iframe");
    iframe.style.width = "min(96vw, 1400px)";
    iframe.style.height = "min(92vh, 900px)";
    iframe.style.border = "0";
    iframe.setAttribute("allow", "autoplay; fullscreen; pointer-lock; gamepad");
    overlay.append(iframe);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) api.endGame();
    });
    document.body.append(overlay);
    state.overlay = overlay;
    state.iframe = iframe;
    return overlay;
  };

  const api: HUBrowserClient = {
    categories,
    types,
    async init(config: HUConfig = {}) {
      try {
        state.config = config;
        state.routes = createRoutes(resolveBase(config.base));
        state.container = ensureContainer(config.container);
        if (
          config.headless !== true &&
          !(state.container instanceof HTMLElement)
        ) {
          throw createHUError(
            "invalid_config",
            "container is required unless headless",
            400,
          );
        }
        if (config.headless !== true) await renderGrid();
        emit("ready");
      } catch (error) {
        const normalized = normalizeError(error, "invalid_config");
        emit("error", normalized);
        throw normalized;
      }
    },
    async query(params: ListOptions = {}, signal?: AbortSignal) {
      const normalized = { ...params };
      if (typeof normalized.q === "string" && normalized.search === undefined) {
        normalized.search = normalized.q;
        delete normalized.q;
      }
      const search = toQuery(normalized);
      try {
        const response = await fetch(
          state.routes.queryPath + (search === "" ? "" : "?" + search),
          {
            signal,
          },
        );
        return await readJson<ListData>(response);
      } catch (error) {
        const normalizedError = normalizeError(error);
        emit("error", normalizedError);
        throw normalizedError;
      }
    },
    async getGames(params: ListOptions = {}, signal?: AbortSignal) {
      return await api.query(params, signal);
    },
    async search(text = "", signal?: AbortSignal) {
      const page = await api.query({ q: text }, signal);
      if (
        state.config?.headless !== true &&
        state.container instanceof HTMLElement
      ) {
        renderGames(page);
      }
      return page;
    },
    async getGame(id: string): Promise<TheatreEntry | undefined> {
      try {
        const response = await fetch(state.routes.gamePath, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (response.status === 404) return undefined;
        return await readJson<TheatreEntry>(response);
      } catch (error) {
        const normalizedError = normalizeError(error);
        emit("error", normalizedError);
        throw normalizedError;
      }
    },
    async getGameUrl(id: string) {
      const game = await api.getGame(id);
      if (!game) return undefined;
      const url = await resolveGameLaunchUrl(game);
      return { url, meta: { id: game.id, name: game.name } };
    },
    async getImageUrl(imageToken: string) {
      if (state.objectUrls.has(imageToken)) {
        return state.objectUrls.get(imageToken) as string;
      }
      try {
        const response = await fetch(
          state.routes.imagePrefix + imageToken + ".webp",
        );
        if (!response.ok) throw await readJson(response);
        const objectUrl = URL.createObjectURL(await response.blob());
        state.objectUrls.set(imageToken, objectUrl);
        return objectUrl;
      } catch (error) {
        const normalizedError = normalizeError(error);
        emit("error", normalizedError);
        throw normalizedError;
      }
    },
    async loadGame(id: string) {
      const game = await api.getGame(id);
      if (!game) {
        const error = createHUError(
          "game_unavailable",
          "Game unavailable",
          404,
        );
        emit("error", error);
        throw error;
      }
      const overlay = ensureOverlay();
      const iframe = state.iframe as HTMLIFrameElement;
      iframe.src = await resolveGameLaunchUrl(game);
      overlay.style.display = "flex";
      emit("gameStart", { id: game.id, name: game.name });
    },
    endGame() {
      if (!state.overlay || !state.iframe) return;
      state.iframe.src = "about:blank";
      state.overlay.style.display = "none";
      emit("gameEnd");
    },
    destroy() {
      api.endGame();
      state.container = null;
      for (const objectUrl of state.objectUrls.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      state.objectUrls.clear();
      if (state.overlay) {
        state.overlay.remove();
        state.overlay = null;
        state.iframe = null;
      }
      if (state.proxyMessageHandler) {
        window.removeEventListener("message", state.proxyMessageHandler);
        state.proxyMessageHandler = null;
      }
      listeners.clear();
    },
    on,
    off,
    async countPlay(id: string) {
      try {
        const response = await fetch(state.routes.playPath, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!response.ok && response.status !== 404) {
          await readJson(response);
        }
      } catch (error) {
        const normalizedError = normalizeError(error);
        emit("error", normalizedError);
        throw normalizedError;
      }
    },
  };

  globalThis.HU = api;
}
