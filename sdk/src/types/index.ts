export interface Control {
  keys: string[];
  label: string;
}

export type GameLaunchType = "embed" | "flash" | "emulator" | "proxy" | "html5";

export interface GameLaunchMetadata {
  type: GameLaunchType;
  subType?: string;
  url: string;
  romUrl?: string;
  core?: string;
  defaultPlayerUrl?: string;
  requiresProxy?: boolean;
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
  launch?: GameLaunchMetadata;
}

export interface TheatreEntryMin {
  name: string;
  id: string;
  category?: string[];
  type?: string;
  src?: string;
  controls?: Control[];
  rank?: number;
  plays?: number;
  hidden?: boolean;
  imagePath?: string;
  launchPath?: string;
}

export declare const CANONICAL_API_BASE: string;
export declare const CANONICAL_CDN_BASE: string;
export declare const CANONICAL_CATALOG_URL: string;

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

export interface HUClientConfig {
  apiBase?: string;
  cdnBase?: string;
  endpoint?: string;
  base?: string;
  mode?: "direct" | "router";
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

export interface HUCatalogClient {
  readonly categories: ReadonlyArray<{ id: string; name: string }>;
  readonly types: ReadonlyArray<string>;
  query(params?: ListOptions, signal?: AbortSignal): Promise<ListData>;
  getGames(params?: ListOptions, signal?: AbortSignal): Promise<ListData>;
  search(text?: string, signal?: AbortSignal): Promise<ListData>;
  getGame(id: string, signal?: AbortSignal): Promise<TheatreEntry | undefined>;
  resolveLaunchMetadata(
    game: TheatreEntry | TheatreEntryMin,
  ): GameLaunchMetadata;
  getImageUrl(idOrToken: string): string;
  countPlay(id: string): Promise<void>;
}

export type HUClient = HUCatalogClient;
export type HUBrowserClient = HUCatalogClient;

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

export declare function createHUClient(
  config?: HUClientConfig,
): HUCatalogClient;
export declare function createHUServerClient(
  config: HUServerClientConfig,
): HUCatalogClient;
export declare function createHURouter(config: HURouterConfig): HURouter;

declare global {
  var HU: HUCatalogClient | undefined;
}
