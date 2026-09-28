/**
 * Holy Unblocker Vite development plugin.
 *
 * Consolidates the local CDN static server and the games-API reverse proxy so
 * any Vite-based partner project can mount Holy Unblocker theatre assets with
 * a single plugin instead of hand-rolling ad-hoc middleware.
 *
 * Security invariant: this plugin targets ONLY public canonical endpoints.
 * Private VLAN/cluster IPs must never appear here.
 *
 *  - `/cdn/*`      -> served from `theatreDir` on disk when the file exists,
 *                     otherwise streamed from `https://holyunb.locker/cdn/`.
 *  - `/v1/games/*` -> proxied to the public REST API with permissive CORS.
 */

import fs from "node:fs";
import path from "node:path";

/** Minimal Connect/Vite middleware types so the SDK stays dependency-free. */
interface ConnectRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface ConnectResponse {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  write(chunk: unknown): void;
  end(chunk?: unknown): void;
}
type ConnectNext = () => void;
interface ConnectMiddlewares {
  use(
    handler: (
      req: ConnectRequest,
      res: ConnectResponse,
      next: ConnectNext,
    ) => void | Promise<void>,
  ): void;
}
interface ViteServerLike {
  middlewares: ConnectMiddlewares;
}
interface VitePluginLike {
  name: string;
  configureServer: (server: ViteServerLike) => void;
}

export interface TheatreDevPluginOptions {
  /**
   * Absolute path to the theatre `public/` directory on disk. When a requested
   * `/cdn/*` asset exists here it is served locally (fast, offline-friendly);
   * otherwise the request falls through to the public CDN.
   */
  theatreDir?: string;
  /**
   * Public base for the games REST API. Must stay a public canonical
   * endpoint — never a private VLAN address.
   * @default "https://holyunb.locker/v1/games/"
   */
  apiBase?: string;
  /**
   * Public base for the static CDN upstream used as a fallback for assets not
   * present in `theatreDir`.
   * @default "https://holyunb.locker/cdn/"
   */
  cdnBase?: string;
}

const DEFAULT_API_BASE = "https://holyunb.locker/v1/games/";
const DEFAULT_CDN_BASE = "https://holyunb.locker/cdn/";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".swf": "application/x-shockwave-flash",
  ".wasm": "application/wasm",
  ".gba": "application/octet-stream",
  ".gbc": "application/octet-stream",
  ".nes": "application/octet-stream",
  ".sfc": "application/octet-stream",
  ".smc": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".z64": "application/octet-stream",
  ".n64": "application/octet-stream",
  ".v64": "application/octet-stream",
  ".epk": "application/octet-stream",
  ".jar": "application/java-archive",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
};

/** Trim trailing slashes so we can join with the request path cleanly. */
function normalizeBase(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/** Copy all upstream headers except framing/encoding ones we set ourselves. */
function copyUpstreamHeaders(
  res: ConnectResponse,
  headers: { entries(): IterableIterator<[string, string]> },
): void {
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "content-encoding" ||
      lower === "content-length" ||
      lower === "transfer-encoding" ||
      lower === "connection"
    ) {
      continue;
    }
    res.setHeader(key, value);
  }
}

/** Stream a WHATWG ReadableStream body to the Connect response. */
async function streamBody(
  res: ConnectResponse,
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!body) {
    res.end();
    return;
  }
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
}

export function theatreDevPlugin(
  options: TheatreDevPluginOptions = {},
): VitePluginLike {
  const theatreDir = options.theatreDir
    ? path.resolve(options.theatreDir)
    : null;
  const apiBase = normalizeBase(options.apiBase ?? DEFAULT_API_BASE);
  const cdnBase = normalizeBase(options.cdnBase ?? DEFAULT_CDN_BASE);

  return {
    name: "holyunblocker-theatre-dev",

    configureServer(server: ViteServerLike) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "/";
        const pathname = url.split("?")[0];

        // ------------------------------------------------------------------
        // Public games REST API proxy  ->  https://holyunb.locker/v1/games/*
        // ------------------------------------------------------------------
        if (pathname.startsWith("/v1/games")) {
          try {
            const upstream = await fetch(
              `${apiBase}${url.slice("/v1/games".length)}`,
              {
                headers: { Accept: "application/json" },
              },
            );
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            res.end(await upstream.text());
          } catch (err) {
            console.warn("[theatre-dev] /v1/games proxy failed:", err);
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Games API unavailable" }));
          }
          return;
        }

        // ------------------------------------------------------------------
        // Static CDN assets  ->  local theatreDir, else public CDN upstream.
        // ------------------------------------------------------------------
        if (!pathname.startsWith("/cdn/")) {
          next();
          return;
        }

        const relPath = decodeURIComponent(pathname.slice("/cdn/".length));

        if (theatreDir) {
          const localFilePath = path.join(theatreDir, relPath);
          // Directory-traversal guard.
          if (
            localFilePath.startsWith(theatreDir + path.sep) ||
            localFilePath === theatreDir
          ) {
            try {
              let finalPath = localFilePath;
              let stat: fs.Stats | null = null;

              if (fs.existsSync(finalPath)) {
                stat = fs.statSync(finalPath);
                if (stat.isDirectory()) {
                  const indexFile = path.join(finalPath, "index.html");
                  if (fs.existsSync(indexFile)) {
                    finalPath = indexFile;
                    stat = fs.statSync(finalPath);
                  } else {
                    stat = null;
                  }
                }
              }

              if (stat && stat.isFile()) {
                const ext = path.extname(finalPath).toLowerCase();
                res.setHeader(
                  "Content-Type",
                  MIME_TYPES[ext] || "application/octet-stream",
                );
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                res.setHeader("Accept-Ranges", "bytes");

                const range = req.headers.range;
                if (typeof range === "string" && range.startsWith("bytes=")) {
                  const [startStr, endStr] = range
                    .replace(/bytes=/, "")
                    .split("-");
                  const start = parseInt(startStr, 10);
                  const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
                  res.statusCode = 206;
                  res.setHeader(
                    "Content-Range",
                    `bytes ${start}-${end}/${stat.size}`,
                  );
                  res.setHeader("Content-Length", end - start + 1);
                  fs.createReadStream(finalPath, { start, end }).pipe(
                    res as never,
                  );
                  return;
                }

                res.statusCode = 200;
                res.setHeader("Content-Length", stat.size);
                fs.createReadStream(finalPath).pipe(res as never);
                return;
              }
            } catch {
              // Fall through to the upstream CDN on any local read failure.
            }
          }
        }

        // Upstream fallback to the public Holy Unblocker CDN.
        try {
          const upstream = await fetch(`${cdnBase}/${relPath}`, {
            headers:
              typeof req.headers.range === "string"
                ? { range: req.headers.range }
                : {},
          });
          res.statusCode = upstream.status;
          copyUpstreamHeaders(res, upstream.headers);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          await streamBody(res, upstream.body);
        } catch {
          next();
        }
      });
    },
  };
}

export default theatreDevPlugin;
