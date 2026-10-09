import type { Duplex } from "node:stream";

export interface HURouterRequest {
  url?: string | null;
  method?: string | null;
  headers?: Record<string, string | string[] | undefined>;
}

export interface HURouterResponse {
  writeHead(status: number, headers?: Record<string, string>): void;
  end(body?: string | Uint8Array): void;
}

export interface HUProxiedGameRoute {
  /** Local path prefix, e.g. "/cdn/html5/fg". */
  prefix: string;
  /** Upstream base URL, e.g. "https://pages.eli.gift/fg/". */
  target: string;
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
  /** True only when the request URL matches a proxied game route. */
  shouldUpgrade(req: HURouterRequest): boolean;
  /**
   * Tunnels a WebSocket upgrade to the matching proxied game route.
   * Returns false (and touches nothing) when no route matches.
   */
  upgrade(req: HURouterRequest, socket: Duplex, head?: Uint8Array): boolean;
}

export interface HURouterConfig {
  mount: string;
  /**
   * Routes used by `shouldUpgrade` / `upgrade`. Defaults to
   * DEFAULT_PROXIED_GAME_ROUTES. Passing an array replaces the default;
   * pass [] to disable upgrade proxying.
   */
  proxiedGameRoutes?: readonly HUProxiedGameRoute[];
}

export declare const DEFAULT_PROXIED_GAME_ROUTES: readonly HUProxiedGameRoute[];

export declare function createHURouter(config: HURouterConfig): HURouter;
