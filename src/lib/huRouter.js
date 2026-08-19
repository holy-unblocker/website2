import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { theatreCategories } from "./gameCategories.ts";
import { theatreTypes } from "./TheatreWrapper.ts";
import { parseHUListQuery } from "./huQuery.ts";
import { toPublicGame, toPublicGameMin } from "./huPublic.ts";
import {
  createHUAssetPath,
  createHUImagePath,
  createHULaunchPath,
  createProxyRouteSeed,
  getProxyRouteMap,
  proxyRouteCookie,
  proxyRouteCookieMaxAge,
  readHUAssetValue,
  readHUImageId,
  readHULaunchId,
} from "./proxyRoutes.js";

const CANONICAL_ORIGIN = "https://holyunb.locker";
const CANONICAL_THEATRE_API = "/api/theatre/";
const browserBootstrapCandidates = [
  new URL("../browser/index.js", import.meta.url),
  new URL("../../sdk/dist/browser/index.js", import.meta.url),
];
const browserCategories = JSON.stringify(
  theatreCategories.map(({ id, name }) => ({ id, name })),
);
const browserTypes = JSON.stringify(theatreTypes);
let browserBootstrapSource;

function getCookie(headers, name) {
  const cookie = headers?.cookie;
  const raw = Array.isArray(cookie) ? cookie.join(";") : cookie;
  if (typeof raw !== "string") return;

  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
}

function readBrowserBootstrapSource() {
  if (typeof browserBootstrapSource === "string") return browserBootstrapSource;

  for (const candidate of browserBootstrapCandidates) {
    try {
      browserBootstrapSource = fs.readFileSync(
        fileURLToPath(candidate),
        "utf8",
      );
      return browserBootstrapSource;
    } catch {}
  }

  throw new Error("Unable to locate built HU browser bootstrap");
}

function buildBootstrap(hu) {
  return readBrowserBootstrapSource()
    .replaceAll("__HU_ROUTES__", JSON.stringify(hu))
    .replaceAll("__HU_CATEGORIES__", browserCategories)
    .replaceAll("__HU_TYPES__", browserTypes);
}

function getRequestOrigin(req) {
  const hostHeader = req.headers?.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (typeof host !== "string" || host === "") return CANONICAL_ORIGIN;
  return `${isSecureRequest(req) ? "https" : "http"}://${host}`;
}

function buildIframePlayerPage(title, src) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  background: #000;
}
iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
</head>
<body>
<iframe src=${JSON.stringify(src)} allow="autoplay; fullscreen; pointer-lock; gamepad"></iframe>
</body>
</html>`;
}

function buildProxyPlayerPage(title, targetUrl, game) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  background: #000;
  color: #fff;
  font-family: system-ui, sans-serif;
}
body {
  display: flex;
  align-items: center;
  justify-content: center;
}
iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: none;
}
#status {
  max-width: 28rem;
  text-align: center;
  padding: 1.5rem;
  line-height: 1.5;
}
</style>
</head>
<body>
<div id="status">Preparing proxy…</div>
<iframe id="proxyFrame" allow="autoplay; fullscreen; pointer-lock; gamepad"></iframe>
<script>
const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);
const hostWindow = window.opener && !window.opener.closed ? window.opener : (window.parent !== window ? window.parent : null);
const status = document.getElementById('status');
const frame = document.getElementById('proxyFrame');
const request = {
  source: 'hu:proxy-player',
  type: 'resolve_proxy_url',
  requestId,
  targetUrl: ${JSON.stringify(targetUrl)},
  game: ${JSON.stringify(game)},
};
const fail = (message) => {
  status.textContent = message;
  status.style.display = 'block';
  frame.style.display = 'none';
};
const showFrame = (url) => {
  frame.src = url;
  frame.style.display = 'block';
  status.style.display = 'none';
};
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data.source !== 'hu:proxy-player' || data.type !== 'resolve_proxy_url_result' || data.requestId !== requestId) {
    return;
  }
  clearTimeout(timeoutId);
  if (typeof data.url === 'string' && data.url !== '') {
    showFrame(data.url);
    return;
  }
  fail(typeof data.error === 'string' ? data.error : 'Proxy resolver failed');
});
if (!hostWindow) {
  fail('Proxy launches require an initialized HU page');
} else {
  hostWindow.postMessage(request, location.origin);
}
const timeoutId = window.setTimeout(() => {
  fail('Timed out waiting for proxy resolver');
}, 10000);
</script>
</body>
</html>`;
}

function isSecureRequest(req) {
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : undefined;
  if (proto === "http") return false;

  const hostHeader = req.headers?.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const hostname = typeof host === "string" ? host.split(":")[0] : "";
  return hostname !== "localhost" && hostname !== "127.0.0.1";
}

function serializeCookie(name, value, secure) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${proxyRouteCookieMaxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function ensureRouteSeed(req) {
  const existing = getCookie(req.headers, proxyRouteCookie);
  if (existing) return { seed: existing };

  const seed = createProxyRouteSeed();
  return {
    seed,
    setCookie: serializeCookie(proxyRouteCookie, seed, isSecureRequest(req)),
  };
}

function jsonHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    ...extra,
  };
}

function writeJson(res, status, body, extraHeaders) {
  res.writeHead(status, jsonHeaders(extraHeaders));
  res.end(JSON.stringify(body));
}

function forwardHeaders(req, includeContentType = false) {
  return {
    ...(typeof req.headers?.cookie === "string"
      ? { cookie: req.headers.cookie }
      : {}),
    ...(includeContentType && typeof req.headers?.["content-type"] === "string"
      ? { "content-type": req.headers["content-type"] }
      : {}),
  };
}

async function readBody(req) {
  if (typeof req[Symbol.asyncIterator] !== "function") return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function readJsonBody(body) {
  if (!body) return null;
  try {
    return JSON.parse(Buffer.from(body).toString("utf8"));
  } catch {
    return null;
  }
}

async function readResponseJson(response) {
  return await response.json().catch(() => null);
}

async function proxyTheatreQuery(req, res, routes, requestUrl) {
  let options;
  try {
    options = parseHUListQuery(requestUrl.searchParams, false);
  } catch (error) {
    writeJson(res, 400, {
      message: error instanceof Error ? error.message : "Invalid query",
    });
    return true;
  }

  if (options.groupBy === "category") {
    const groups = (
      await Promise.all(
        theatreCategories.map(async (category) => {
          const params = new URLSearchParams(requestUrl.searchParams);
          params.set("category", category.id);
          params.delete("groupBy");
          params.delete("limit");
          params.delete("offset");
          params.delete("page");
          if (typeof options.limitPerGroup === "number") {
            params.set("limit", String(options.limitPerGroup));
          }
          params.delete("limitPerGroup");

          const response = await fetch(
            new URL(
              `${CANONICAL_THEATRE_API}?${params.toString()}`,
              CANONICAL_ORIGIN,
            ),
            {
              headers: forwardHeaders(req),
            },
          );

          if (!response.ok) return null;
          const result = await readResponseJson(response);
          if (
            !result ||
            !Array.isArray(result.entries) ||
            result.entries.length === 0
          ) {
            return null;
          }

          return {
            key: category.id,
            label: category.name,
            games: result.entries.map((entry, index) => ({
              ...toPublicGameMin(entry, index + 1),
              imagePath: createHUImagePath(routes, entry.id),
              launchPath: createHULaunchPath(routes, entry.id),
            })),
            total: typeof result.total === "number" ? result.total : 0,
          };
        }),
      )
    ).filter(Boolean);

    writeJson(res, 200, { groups });
    return true;
  }

  const upstreamUrl = new URL(
    `${CANONICAL_THEATRE_API}?${requestUrl.searchParams.toString()}`,
    CANONICAL_ORIGIN,
  );
  const response = await fetch(upstreamUrl, {
    headers: forwardHeaders(req),
  });
  const result = await readResponseJson(response);

  if (!response.ok || !result || !Array.isArray(result.entries)) {
    if (typeof result === "object" && result !== null) {
      writeJson(res, response.status, result);
    } else {
      res.writeHead(response.status, jsonHeaders());
      res.end();
    }
    return true;
  }

  const games = result.entries.map((entry, index) => ({
    ...toPublicGameMin(entry, index + 1),
    imagePath: createHUImagePath(routes, entry.id),
    launchPath: createHULaunchPath(routes, entry.id),
  }));
  const total = typeof result.total === "number" ? result.total : games.length;
  const limit =
    typeof options.limit === "number"
      ? options.limit
      : Math.max(games.length, 1);
  const page =
    Math.floor(
      (typeof options.offset === "number" ? options.offset : 0) / limit,
    ) + 1;
  const pages = total === 0 ? 0 : Math.ceil(total / limit);

  writeJson(res, 200, {
    total,
    page,
    pages,
    entries: games,
    games,
  });
  return true;
}

async function proxyTheatreGame(req, res, routes, body) {
  const payload = readJsonBody(body);
  const id = typeof payload?.id === "string" ? payload.id : undefined;
  if (!id) {
    writeJson(res, 400, { message: "Missing game id" });
    return true;
  }

  const response = await fetch(
    new URL(
      `${CANONICAL_THEATRE_API}${encodeURIComponent(id)}/`,
      CANONICAL_ORIGIN,
    ),
    {
      headers: forwardHeaders(req),
    },
  );

  if (response.status === 404) {
    res.writeHead(404, jsonHeaders());
    res.end();
    return true;
  }

  const entry = await readResponseJson(response);
  if (!response.ok || !entry) {
    if (typeof entry === "object" && entry !== null) {
      writeJson(res, response.status, entry);
    } else {
      res.writeHead(response.status, jsonHeaders());
      res.end();
    }
    return true;
  }

  const assetPath =
    typeof entry.src === "string" && entry.src.startsWith("./")
      ? createHUAssetPath(routes, entry.src)
      : undefined;

  writeJson(res, 200, {
    ...toPublicGame(entry),
    imagePath: createHUImagePath(routes, entry.id),
    launchPath: createHULaunchPath(routes, entry.id),
    assetPath:
      typeof assetPath === "string" &&
      entry.src.endsWith("/") &&
      !assetPath.endsWith("/")
        ? `${assetPath}/`
        : assetPath,
    playerPath:
      typeof entry.type === "string" && entry.type.startsWith("emulator")
        ? routes.hu.webretroPath
        : undefined,
  });
  return true;
}

async function proxyTheatrePlay(req, res, body) {
  const payload = readJsonBody(body);
  const id = typeof payload?.id === "string" ? payload.id : undefined;
  if (!id) {
    writeJson(res, 400, { message: "Missing game id" });
    return true;
  }

  const response = await fetch(
    new URL(
      `${CANONICAL_THEATRE_API}${encodeURIComponent(id)}/plays`,
      CANONICAL_ORIGIN,
    ),
    {
      method: "PUT",
      headers: forwardHeaders(req),
    },
  );

  if (response.status === 404) {
    res.writeHead(404, jsonHeaders());
    res.end();
    return true;
  }

  if (!response.ok) {
    const result = await readResponseJson(response);
    if (typeof result === "object" && result !== null) {
      writeJson(res, response.status, result);
    } else {
      res.writeHead(response.status, jsonHeaders());
      res.end();
    }
    return true;
  }

  writeJson(res, 200, {});
  return true;
}

async function proxyTheatrePlayer(req, res, routes, requestUrl) {
  const token = requestUrl.searchParams.get("v");
  const id = token === null ? undefined : readHULaunchId(routes, token);
  if (!id) {
    res.writeHead(404, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    });
    res.end("<!doctype html><title>Not found</title>");
    return true;
  }

  const response = await fetch(
    new URL(
      `${CANONICAL_THEATRE_API}${encodeURIComponent(id)}/`,
      CANONICAL_ORIGIN,
    ),
    {
      headers: forwardHeaders(req),
    },
  );

  if (response.status === 404) {
    res.writeHead(404, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    });
    res.end("<!doctype html><title>Not found</title>");
    return true;
  }

  const entry = await readResponseJson(response);
  if (!response.ok || !entry || typeof entry.src !== "string") {
    res.writeHead(response.ok ? 502 : response.status, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    });
    res.end("<!doctype html><title>Unavailable</title>");
    return true;
  }

  const origin = getRequestOrigin(req);
  let assetPath = entry.src.startsWith("./")
    ? createHUAssetPath(routes, entry.src)
    : undefined;
  if (
    typeof assetPath === "string" &&
    entry.src.endsWith("/") &&
    !assetPath.endsWith("/")
  ) {
    assetPath += "/";
  }
  const launchUrl = assetPath ? origin + assetPath : entry.src;
  let page;

  if (typeof entry.type === "string" && entry.type.startsWith("emulator")) {
    page = buildIframePlayerPage(
      entry.name,
      routes.hu.webretroPath +
        "?" +
        new URLSearchParams({
          rom: launchUrl,
          core: "autodetect",
        }),
    );
  } else if (entry.type === "proxy") {
    page = buildProxyPlayerPage(entry.name, launchUrl, {
      id: entry.id,
      name: entry.name,
      type: entry.type,
    });
  } else {
    page = buildIframePlayerPage(entry.name, launchUrl);
  }

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-store",
  });
  res.end(page);
  return true;
}

function resolveInternalPath(url, routes) {
  const requestUrl = new URL(url, CANONICAL_ORIGIN);

  if (requestUrl.pathname === routes.hu.queryPath) {
    return { type: "query" };
  }
  if (requestUrl.pathname === routes.hu.gamePath) {
    return { type: "game" };
  }
  if (requestUrl.pathname === routes.hu.playPath) {
    return { type: "play" };
  }
  if (requestUrl.pathname === routes.hu.playerPath) {
    return { type: "player" };
  }
  if (requestUrl.pathname === routes.hu.webretroPath) {
    return {
      type: "internal",
      path: "/cdn/html5/webretro/" + requestUrl.search,
    };
  }
  if (requestUrl.pathname.startsWith(routes.hu.webretroPath + "/")) {
    return {
      type: "internal",
      path:
        "/cdn/html5/webretro" +
        requestUrl.pathname.slice(routes.hu.webretroPath.length) +
        requestUrl.search,
    };
  }

  const huAssetValue = readHUAssetValue(routes, requestUrl.pathname);
  if (typeof huAssetValue === "string" && huAssetValue.startsWith("./")) {
    return {
      type: "internal",
      path: `/cdn/${huAssetValue.slice(2)}${requestUrl.search}`,
    };
  }

  const huImageId = readHUImageId(routes, requestUrl.pathname);
  if (huImageId) {
    return {
      type: "internal",
      path: `/cdn/thumbnails/${encodeURIComponent(huImageId)}.webp${requestUrl.search}`,
    };
  }

  return { type: "none" };
}

export function createHURouter({ mount }) {
  const normalizedMount = mount.endsWith("/") ? mount : `${mount}/`;

  return {
    shouldRoute(req) {
      const url = req.url ?? "";
      if (url === `${normalizedMount}index.js`) return true;

      const seed = getCookie(req.headers, proxyRouteCookie);
      const routes = getProxyRouteMap(seed, normalizedMount);
      const pathname = new URL(url, CANONICAL_ORIGIN).pathname;

      return (
        pathname === routes.hu.queryPath ||
        pathname === routes.hu.gamePath ||
        pathname === routes.hu.playPath ||
        pathname === routes.hu.playerPath ||
        pathname === routes.hu.webretroPath ||
        pathname.startsWith(routes.hu.webretroPath + "/") ||
        pathname.startsWith(routes.hu.assetPrefix) ||
        pathname.startsWith(routes.hu.imagePrefix)
      );
    },
    async route(req, res, options = {}) {
      if (!this.shouldRoute(req)) return false;

      const requestUrl = new URL(req.url ?? normalizedMount, CANONICAL_ORIGIN);
      const bootstrapRequest =
        requestUrl.pathname === `${normalizedMount}index.js`;
      const { seed, setCookie } = bootstrapRequest
        ? ensureRouteSeed(req)
        : {
            seed: getCookie(req.headers, proxyRouteCookie),
            setCookie: undefined,
          };
      const routes = getProxyRouteMap(seed, normalizedMount);

      if (bootstrapRequest) {
        const headers = {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "private, no-store",
          ...(setCookie ? { "set-cookie": setCookie } : {}),
        };
        res.writeHead(200, headers);
        res.end(buildBootstrap(routes.hu));
        return true;
      }

      const resolved = resolveInternalPath(req.url ?? normalizedMount, routes);
      if (resolved.type === "none") {
        res.writeHead(404, jsonHeaders());
        res.end(JSON.stringify({ message: "Not found" }));
        return true;
      }

      const method = req.method ?? "GET";
      const body =
        method === "GET" || method === "HEAD" ? undefined : await readBody(req);

      if (resolved.type === "query") {
        return await proxyTheatreQuery(req, res, routes, requestUrl);
      }
      if (resolved.type === "game") {
        return await proxyTheatreGame(req, res, routes, body);
      }
      if (resolved.type === "play") {
        return await proxyTheatrePlay(req, res, body);
      }
      if (resolved.type === "player") {
        return await proxyTheatrePlayer(req, res, routes, requestUrl);
      }

      if (typeof options.localHandler === "function") {
        await options.localHandler(resolved.path);
        return true;
      }

      const response = await fetch(new URL(resolved.path, CANONICAL_ORIGIN), {
        method,
        headers: {
          ...forwardHeaders(req, true),
          "accept-encoding": "identity",
        },
        body,
        duplex: body ? "half" : undefined,
      });

      const responseHeaders = {};
      for (const [key, value] of response.headers.entries()) {
        if (key === "content-encoding") continue;
        if (key === "content-length") continue;
        responseHeaders[key] = value;
      }
      res.writeHead(response.status, responseHeaders);
      res.end(new Uint8Array(await response.arrayBuffer()));
      return true;
    },
  };
}
