import type { AppCloak } from "./cloak";
import {
  setupBareMux,
  setupScramjet,
  unregisterServiceWorker,
  getProxyEngine,
} from "./register-sw";
import { getSiteConfig, setSiteConfig } from "./siteConfig";
import {
  encodeEngine,
  encodeRelay,
  encodeTransport,
  engineCookie,
  legacyRelayCookies,
  relayCookies,
  transportCookie,
} from "./proxyCookies.js";

function getCookie(name: string) {
  for (const cookie of document.cookie.split("; ")) {
    const n = name + "=";
    if (cookie.startsWith(n)) return cookie.slice(n.length);
  }
}

function cookieDomainAttr() {
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
    return "";
  return `; domain=.${host}`;
}

function setCookie(name: string, value: string) {
  // 400 days
  const maxAge = 60 * 24 * 400;
  document.cookie = `${name}=${value}; max-age=${maxAge}; samesite=strict; path=/${cookieDomainAttr()}`;
}

export function clearCookie(name: string) {
  document.cookie = `${name}=; max-age=0; samesite=strict; path=/${cookieDomainAttr()}`;
}

// The server URI-encodes a cookie value; the client wrote it raw.
function cookieText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Forget a saved bare or wisp server, under its current and its old name.
export function clearRelayCookie(kind: "bare" | "wisp") {
  clearCookie(relayCookies[kind]);
  clearCookie(legacyRelayCookies[kind]);
}

// Settings saved before the cookie rename (proxyCookies.js) used names and
// values that named the proxy. The server adopts them on the next request;
// this drops the browser's own copy, which may be host-only where the
// server's expiry cannot reach it.
export function migrateProxyCookies() {
  for (const kind of ["bare", "wisp"] as const) {
    const legacy = getCookie(legacyRelayCookies[kind]);
    if (legacy === undefined) continue;
    if (legacy && getCookie(relayCookies[kind]) === undefined)
      setCookie(relayCookies[kind], encodeRelay(cookieText(legacy)));
    clearCookie(legacyRelayCookies[kind]);
  }
  const transport = getCookie(transportCookie);
  if (transport === "epoxy" || transport === "bare")
    setCookie(transportCookie, encodeTransport(transport)!);
  const engine = getCookie(engineCookie);
  if (engine === "uv" || engine === "sj")
    setCookie(engineCookie, encodeEngine(engine)!);
}

export function setTheme(theme: string) {
  setCookie("theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function setSearchEngine(searchEngine: number) {
  setCookie("srch", searchEngine.toString());
}

export function setProxyTransport(proxyTransport: string) {
  setSiteConfig("transport", proxyTransport);
  const code = encodeTransport(proxyTransport);
  if (code) setCookie(transportCookie, code);
  if (getProxyEngine() === "sj") setupScramjet();
  else setupBareMux();
}

export function setProxyEngine(proxyEngine: string) {
  setSiteConfig("engine", proxyEngine);
  const code = encodeEngine(proxyEngine);
  if (code) setCookie(engineCookie, code);
}

export function setAdblock(enabled: boolean) {
  setSiteConfig("adblock", enabled ? "1" : "0");
  setCookie("adblock", enabled ? "1" : "0");
  // The service worker bakes in the adblock flag from its script URL, so it
  // must be unregistered immediately for the change to take effect.
  unregisterServiceWorker();
}

export function setNoscript(enabled: boolean) {
  setSiteConfig("noscript", enabled ? "1" : "0");
  setCookie("noscript", enabled ? "1" : "0");
  unregisterServiceWorker();
}

// used for dynamically applying the new tab cloak
// thanks astro transitions...
export function getCloak() {
  const cookie = getCookie("cloak");
  if (cookie === undefined) return;
  const cloak: AppCloak = Object.fromEntries([
    ...new URLSearchParams(decodeURIComponent(cookie)).entries(),
  ]) as any;

  return cloak;
}

// client-side equivalent of the server's setCloak (middleware.ts). encodes the
// cloak the same way (URLSearchParams of { icon, title, url }) so getCloak and
// the server agree on the format. lets the pill list apply a built-in cloak
// instantly without a full page round-trip.
export function setCloak(cloak: AppCloak) {
  setCookie("cloak", new URLSearchParams({ ...cloak }).toString());
}

export function setProxyMode(proxyMode: string) {
  setCookie("prx", proxyMode);
}

export function setRuntimeCloak(slug: string) {
  setCookie("runtimeCloak", slug);
}

export function setBareServer(bareServer: string) {
  setSiteConfig("bare", bareServer);
  setCookie(relayCookies.bare, encodeRelay(bareServer));
}

export function setWispServer(wispServer: string) {
  setSiteConfig("wisp", wispServer);
  setCookie(relayCookies.wisp, encodeRelay(wispServer));
}

// toggle routing the proxy through tor. the server hosts a second bare/wisp
// pair that goes through tor and routes clients to it based on the "t" cookie.
// while tor is on we pin the bare/wisp servers to this instance (clearing any
// custom server) so traffic actually flows through our tor-routed servers.
export function setTor(enabled: boolean) {
  const config = getSiteConfig();
  setSiteConfig("tor", enabled ? "1" : "0");
  setCookie("t", enabled ? "1" : "0");
  if (enabled) {
    // drop any custom bare/wisp server so we use this instance's routed ones,
    // and reset the runtime config to the instance defaults
    clearRelayCookie("bare");
    clearRelayCookie("wisp");
    setSiteConfig("bare", config.defaultBare);
    setSiteConfig("wisp", config.defaultWisp);
  }
  // tor routing is enforced by the service worker / transport, so unregister
  // immediately on toggle so the change takes effect without a stale worker.
  unregisterServiceWorker();
}
