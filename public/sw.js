// Ultraviolet + Scramjet service worker, with optional domain adblocking.
importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts(__uv$config.sw || "/uv/uv.sw.js");
importScripts("/scramjet/controller.sw.js");

let uv;
function getUV() {
  if (!uv) uv = new UVServiceWorker();
  return uv;
}

const ADBLOCK_ENABLED =
  new URL(self.location.href).searchParams.get("adblock") === "1";

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

self.addEventListener("fetch", (event) => {
  // Scramjet handles its own prefix (/scram/service/ routes)
  if (
    typeof $scramjetController !== "undefined" &&
    $scramjetController.shouldRoute(event)
  ) {
    if (isBlacklistedDomain(scramjetTargetHostname(event.request.url))) {
      event.respondWith(blocked());
      return;
    }
    event.respondWith($scramjetController.route(event));
    return;
  }

  // Ultraviolet
  if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
    if (isBlacklistedDomain(uvTargetHostname(event.request.url))) {
      event.respondWith(blocked());
      return;
    }
    event.respondWith(getUV().fetch(event));
  }
});
