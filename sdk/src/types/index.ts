export interface Control {
  keys: string[];
  label: string;
}

export interface TheatreEntry {
  type: string;
  controls: Control[];
  category: string[];
  id: string;
  name: string;
  plays: number;
  src: string;
  hidden: boolean;
  imagePath?: string;
  launchPath?: string;
  assetPath?: string;
  playerPath?: string;
}

export interface TheatreEntryMin {
  name: string;
  id: string;
  category: string[];
  type?: string;
  controls?: Control[];
  rank?: number;
  plays?: number;
  hidden?: boolean;
  imagePath?: string;
  launchPath?: string;
}

export interface ListData {
  total: number;
  page?: number;
  pages?: number;
  entries: TheatreEntryMin[];
  games?: TheatreEntryMin[];
  groups?: Array<{
    key: string;
    label: string;
    games: TheatreEntryMin[];
    total: number;
  }>;
}

export interface ListOptions {
  q?: string | null;
  search?: string | null;
  order?: "desc" | "asc" | string | null;
  sort?:
    | "index"
    | "name"
    | "plays"
    | "popular"
    | "new"
    | "relevance"
    | "random"
    | string
    | null;
  limit?: number;
  page?: number;
  offset?: number;
  limitPerGroup?: number;
  groupBy?: "category" | string | null;
  seed?: string | null;
  category?: string[] | null;
  type?: string[] | null;
  ids?: string[];
  includeHidden?: boolean;
}

export interface HUProxyResolveRequest {
  targetUrl: string;
  game: {
    id: string;
    name: string;
    type?: string;
  };
}

export interface HUProxyConfig {
  resolveUrl(request: HUProxyResolveRequest): Promise<string> | string;
}

export interface HUClient {
  readonly categories: ReadonlyArray<{ id: string; name: string }>;
  readonly types: ReadonlyArray<string>;
  query(params?: ListOptions, signal?: AbortSignal): Promise<ListData>;
  getGames(params?: ListOptions, signal?: AbortSignal): Promise<ListData>;
  search(text?: string, signal?: AbortSignal): Promise<ListData>;
  getGame(id: string): Promise<TheatreEntry | undefined>;
}

export interface HUBrowserClient extends HUClient {
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
    proxy?: HUProxyConfig;
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
  countPlay(id: string): Promise<void>;
}

export interface HUServerClientConfig {
  publicBase: string;
  endpoint?: string;
}

export interface HURouterRequest {
  url?: string | null;
  method?: string | null;
  headers?: Record<string, string | string[] | undefined>;
}

export interface HURouterResponse {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string | Uint8Array): void;
}

export interface HURouter {
  shouldRoute(req: HURouterRequest): boolean;
  route(
    req: HURouterRequest,
    res: HURouterResponse,
    options?: {
      localHandler?: (path: string) => Promise<void> | void;
    },
  ): Promise<boolean>;
}

export interface HURouterConfig {
  mount: string;
}

export declare function createHUServerClient(
  config: HUServerClientConfig,
): HUClient;
export declare function createHURouter(config: HURouterConfig): HURouter;

declare global {
  var HU: HUBrowserClient | undefined;
}
