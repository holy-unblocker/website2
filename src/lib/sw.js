// Ultraviolet + Scramjet service worker, with optional domain adblocking.
importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts(globalThis["__uv$config"].sw || "/uv/uv.sw.js");
importScripts("/scramjet/controller.sw.js");

let uv;
function getUV() {
  if (!uv) uv = new UVServiceWorker();
  return uv;
}

const ADBLOCK_ENABLED =
  new URL(self.location.href).searchParams.get("adblock") === "1";

const NOSCRIPT_ENABLED =
  new URL(self.location.href).searchParams.get("noscript") === "1";

const SJ_PREFIX = "/scram/service/";

const blacklist = {};
let blacklistReady = false;

if (ADBLOCK_ENABLED) {
  fetch("/assets/blacklist.txt")
    .then((res) => res.text())
    .then((textData) => {
      textData
        .split("\n")
        .map((line) => line.trim())
        .filter((domain) => domain && !domain.startsWith("#"))
        .forEach((domain) => {
          const domainTld = domain.replace(/.+(?=\.\w)/, "");
          if (!blacklist.hasOwnProperty(domainTld)) blacklist[domainTld] = [];
          blacklist[domainTld].push(
            encodeURIComponent(domain.slice(0, -domainTld.length))
              .replace(/([()])/g, "\\$1")
              .replace(/(\*\.)|\./g, (match, exp) =>
                exp ? "(?:.+\\.)?" : "\\" + match,
              ),
          );
        });

      for (const [tld, domains] of Object.entries(blacklist))
        blacklist[tld] = new RegExp(`^(?:${domains.join("|")})$`);
      Object.freeze(blacklist);
      blacklistReady = true;
    })
    .catch((err) => console.error("adblock: failed to load blacklist", err));
}

function isBlacklistedDomain(domain) {
  if (!ADBLOCK_ENABLED || !blacklistReady || !domain) return false;
  const domainTld = domain.replace(/.+(?=\.\w)/, "");
  return (
    blacklist.hasOwnProperty(domainTld) &&
    blacklist[domainTld].test(domain.slice(0, -domainTld.length))
  );
}

function scramjetTargetHostname(reqUrl) {
  try {
    const path = new URL(reqUrl).pathname;
    if (!path.startsWith(SJ_PREFIX)) return null;
    const rest = path.slice(SJ_PREFIX.length).split("/");
    if (rest.length < 3) return null;
    const encoded = rest.slice(2).join("/");
    if (!encoded) return null;
    return new URL(decodeURIComponent(encoded)).hostname;
  } catch {
    return null;
  }
}

// Extract the real target hostname from an Ultraviolet service URL.
function uvTargetHostname(reqUrl) {
  try {
    const encoded = new URL(reqUrl).pathname.replace(__uv$config.prefix, "");
    return new URL(__uv$config.decodeUrl(encoded)).hostname;
  } catch {
    return null;
  }
}

const blocked = () => new Response(new Blob(), { status: 406 });

// when noscript is enabled, requests for scripts inside the proxy are
// neutralized by serving an empty script body instead of the real one.
const SCRIPT_DESTINATIONS = [
  "script",
  "worker",
  "sharedworker",
  "serviceworker",
];
const isScriptRequest = (request) =>
  NOSCRIPT_ENABLED && SCRIPT_DESTINATIONS.includes(request.destination);
const emptyScript = () =>
  new Response("", {
    status: 200,
    headers: { "content-type": "text/javascript" },
  });

// strip every <script> tag, inline on* event handler, and javascript: url from
// an HTML string so proxied pages can't execute any JS.
function stripScripts(html) {
  return (
    html
      // drop <script ...>...</script> blocks (including unclosed trailing ones)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*$/gi, "")
      // drop self-closing / sourced script tags with no body
      .replace(/<script\b[^>]*\/?>/gi, "")
      // drop <noscript> wrappers but keep their contents (they're the fallback)
      .replace(/<\/?noscript\b[^>]*>/gi, "")
      // strip inline event handlers: on...="..." / on...='...' / on...=value
      .replace(/\son[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/gi, "")
      // neutralize javascript: urls in href/src/action/etc.
      .replace(
        /\s(href|src|action|formaction|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s"'>]+)/gi,
        ' $1="#"',
      )
  );
}

const HTML_TYPE = /text\/html|application\/xhtml\+xml/i;

// if noscript is on and the response is HTML, rewrite the body to remove all JS.
async function sanitizeResponse(response) {
  if (!NOSCRIPT_ENABLED) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!HTML_TYPE.test(contentType)) return response;

  const html = await response.text();
  const stripped = stripScripts(html);

  const headers = new Headers(response.headers);
  // body length changed; let the browser recompute it
  headers.delete("content-length");
  // a CSP that forbids scripts as a second layer of defense
  headers.set(
    "content-security-policy",
    "script-src 'none'; worker-src 'none';",
  );

  return new Response(stripped, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  // Scramjet handles its own service prefix.
  if ($scramjetController.shouldRoute(event)) {
    if (isBlacklistedDomain(scramjetTargetHostname(event.request.url))) {
      event.respondWith(blocked());
      return;
    }
    if (isScriptRequest(event.request)) {
      event.respondWith(emptyScript());
      return;
    }
    event.respondWith(
      Promise.resolve($scramjetController.route(event)).then(sanitizeResponse),
    );
    return;
  }

  // Ultraviolet
  if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
    if (isBlacklistedDomain(uvTargetHostname(event.request.url))) {
      event.respondWith(blocked());
      return;
    }
    if (isScriptRequest(event.request)) {
      event.respondWith(emptyScript());
      return;
    }
    event.respondWith(
      Promise.resolve(getUV().fetch(event)).then(sanitizeResponse),
    );
  }
});
