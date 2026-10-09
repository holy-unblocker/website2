import http from "node:http";
import https from "node:https";
import type { Duplex } from "node:stream";
import { createHURouter as createRouter } from "../../../src/lib/huRouter.js";

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

/**
 * Absolute paths to each proxy engine's dist directory. Supplying a path here
 * means the matching engine package is never required when serving its assets.
 * Any field left out is resolved lazily (and only if an engine asset route is
 * actually hit). Importing or constructing the router never touches an engine.
 */
export interface HUEnginePaths {
  uv?: string;
  bareModule?: string;
  bareMux?: string;
  scramjet?: string;
}

export interface HURouterConfig {
  mount: string;
  /**
   * Routes used by `shouldUpgrade` / `upgrade`. Defaults to
   * DEFAULT_PROXIED_GAME_ROUTES. Passing an array replaces the default;
   * pass [] to disable upgrade proxying.
   */
  proxiedGameRoutes?: readonly HUProxiedGameRoute[];
  /**
   * Optional engine dist paths. When absent, engine asset paths resolve lazily
   * on first use, so the router — and its data API, opaque-token routes and
   * WebSocket upgrade handling — works with no proxy engines installed.
   */
  enginePaths?: HUEnginePaths;
}

export const DEFAULT_PROXIED_GAME_ROUTES: readonly HUProxiedGameRoute[] = [
  { prefix: "/cdn/html5/fg", target: "https://pages.eli.gift/fg/" },
];

const UPGRADE_TIMEOUT_MS = 15_000;

interface NormalizedRoute {
  prefix: string;
  target: URL;
}

function normalizeRoutes(
  routes: readonly HUProxiedGameRoute[],
): NormalizedRoute[] {
  return routes.map((route) => {
    if (!route.prefix.startsWith("/")) {
      throw new Error(
        `proxied game route prefix must start with "/": ${route.prefix}`,
      );
    }
    const target = new URL(
      route.target.endsWith("/") ? route.target : `${route.target}/`,
    );
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      throw new Error(
        `proxied game route target must be http(s): ${route.target}`,
      );
    }
    return { prefix: route.prefix.replace(/\/+$/, ""), target };
  });
}

function findRoute(
  url: string | null | undefined,
  routes: NormalizedRoute[],
): NormalizedRoute | null {
  if (!url) return null;
  const pathname = url.split("?")[0];
  for (const route of routes) {
    if (pathname === route.prefix || pathname.startsWith(route.prefix + "/")) {
      return route;
    }
  }
  return null;
}

// Maps "<prefix>/<sub>?<query>" onto the target. Returns null when the result
// would leave the target's origin or path (dot segments, encoded dots, etc.).
function buildTargetUrl(url: string, route: NormalizedRoute): URL | null {
  const queryAt = url.indexOf("?");
  const query = queryAt === -1 ? "" : url.slice(queryAt);
  const pathname = queryAt === -1 ? url : url.slice(0, queryAt);
  const subPath = pathname.slice(route.prefix.length).replace(/^\//, "");
  const resolved = new URL(subPath + query, route.target);
  if (
    resolved.origin !== route.target.origin ||
    !resolved.pathname.startsWith(route.target.pathname)
  ) {
    return null;
  }
  return resolved;
}

function writeResponseHead(
  socket: Duplex,
  status: number,
  message: string,
  headers: http.IncomingHttpHeaders,
): void {
  let out = `HTTP/1.1 ${status} ${message}\r\n`;
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      out += `${key}: ${item}\r\n`;
    }
  }
  socket.write(out + "\r\n");
}

function tunnelUpgrade(
  req: HURouterRequest,
  socket: Duplex,
  head: Uint8Array | undefined,
  resolved: URL,
): void {
  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: resolved.host,
    origin: resolved.origin,
    referer: resolved.href,
    upgrade: "websocket",
    connection: "Upgrade",
  };

  const client = resolved.protocol === "https:" ? https : http;
  const proxyReq = client.request(resolved.toString(), {
    method: "GET",
    headers,
  });
  let upgraded = false;

  // Bounds connect + handshake only. Cleared once the upstream answers, so an
  // established WebSocket is not killed by an idle timeout.
  const connectTimer = setTimeout(() => {
    proxyReq.destroy(new Error("upgrade timed out"));
  }, UPGRADE_TIMEOUT_MS);

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    clearTimeout(connectTimer);
    upgraded = true;
    if (socket.destroyed) {
      proxySocket.destroy();
      return;
    }
    writeResponseHead(socket, 101, "Switching Protocols", proxyRes.headers);
    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    if (head && head.length) proxySocket.write(head);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
    proxySocket.on("error", () => socket.destroy());
    socket.on("error", () => proxySocket.destroy());
    proxySocket.on("close", () => socket.destroy());
    socket.on("close", () => proxySocket.destroy());
  });

  proxyReq.on("response", (proxyRes) => {
    // Upstream refused the upgrade (400/403/...): pass status, headers and body.
    clearTimeout(connectTimer);
    if (socket.destroyed) {
      proxyRes.destroy();
      return;
    }
    writeResponseHead(
      socket,
      proxyRes.statusCode ?? 502,
      proxyRes.statusMessage || "Error",
      proxyRes.headers,
    );
    proxyRes.on("error", () => socket.destroy());
    proxyRes.pipe(socket);
  });

  proxyReq.on("error", (error) => {
    clearTimeout(connectTimer);
    console.error(
      `HU router: websocket upgrade for ${resolved.pathname} failed:`,
      error.message,
    );
    socket.destroy();
  });

  socket.on("error", () => proxyReq.destroy());
  socket.on("close", () => {
    clearTimeout(connectTimer);
    if (!upgraded) proxyReq.destroy();
  });
  proxyReq.end();
}

export function createHURouter(config: HURouterConfig): HURouter {
  const base = createRouter({
    mount: config.mount,
    enginePaths: config.enginePaths,
  });
  const routes = normalizeRoutes(
    config.proxiedGameRoutes ?? DEFAULT_PROXIED_GAME_ROUTES,
  );

  return {
    ...base,
    shouldUpgrade(req) {
      return findRoute(req.url, routes) !== null;
    },
    upgrade(req, socket, head) {
      const route = findRoute(req.url, routes);
      if (!route) return false;
      const resolved = buildTargetUrl(req.url ?? "/", route);
      if (!resolved) {
        socket.destroy();
        return true;
      }
      tunnelUpgrade(req, socket, head, resolved);
      return true;
    },
  };
}
