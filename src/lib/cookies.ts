import type { AppCloak } from "./cloak";
import {
  setupBareMux,
  setupScramjet,
  setupServiceWorker,
  getProxyEngine,
} from "./register-sw";

function getCookie(name: string) {
  for (const cookie of document.cookie.split("; ")) {
    const n = name + "=";
    if (cookie.startsWith(n)) return cookie.slice(n.length);
  }
}

function setCookie(name: string, value: string) {
  // 400 days
  const maxAge = 60 * 24 * 400;
  document.cookie = `${name}=${value}; max-age=${maxAge}; samesite=strict; path=/; domain=.${location.hostname}`;
}

export function setTheme(theme: string) {
  setCookie("theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function setSearchEngine(searchEngine: number) {
  setCookie("srch", searchEngine.toString());
}

export function setProxyTransport(proxyTransport: string) {
  const ele = document.getElementById("configThing")!;
  ele.setAttribute("data-transport", proxyTransport);
  setCookie("trans", proxyTransport);
  if (getProxyEngine() === "scramjet") setupScramjet();
  else setupBareMux();
}

export function setProxyEngine(proxyEngine: string) {
  const ele = document.getElementById("configThing");
  if (ele) ele.setAttribute("data-engine", proxyEngine);
  setCookie("engine", proxyEngine);
}

export function setAdblock(enabled: boolean) {
  const ele = document.getElementById("configThing");
  if (ele) ele.setAttribute("data-adblock", enabled ? "1" : "0");
  setCookie("adblock", enabled ? "1" : "0");
  // The service worker bakes in the adblock flag from its script URL, so it
  // must be re-registered for the change to take effect.
  setupServiceWorker();
}

export function setNoscript(enabled: boolean) {
  const ele = document.getElementById("configThing");
  if (ele) ele.setAttribute("data-noscript", enabled ? "1" : "0");
  setCookie("noscript", enabled ? "1" : "0");
  setupServiceWorker();
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

export function setProxyMode(proxyMode: string) {
  setCookie("prx", proxyMode);
}

export function setBareServer(bareServer: string) {
  const ele = document.getElementById("configThing")!;
  ele.setAttribute("data-bare", bareServer);
  setCookie("bareServer", bareServer);
}

export function setWispServer(wispServer: string) {
  const ele = document.getElementById("configThing")!;
  ele.setAttribute("data-wisp", wispServer);
  setCookie("wispServer", wispServer);
}

// toggle routing the proxy through tor. the server hosts a second bare/wisp
// pair that goes through tor and routes clients to it based on the "t" cookie.
// while tor is on we pin the bare/wisp servers to this instance (clearing any
// custom server) so traffic actually flows through our tor-routed servers.
export function setTor(enabled: boolean) {
  const ele = document.getElementById("configThing");
  if (ele) ele.setAttribute("data-tor", enabled ? "1" : "0");
  setCookie("t", enabled ? "1" : "0");
  if (enabled && ele) {
    // drop any custom bare/wisp server so we use this instance's routed ones,
    // and reset the runtime config to the instance defaults
    document.cookie = `bareServer=; max-age=0; samesite=strict; path=/; domain=.${location.hostname}`;
    document.cookie = `wispServer=; max-age=0; samesite=strict; path=/; domain=.${location.hostname}`;
    const defaultBare = ele.getAttribute("data-default-bare");
    const defaultWisp = ele.getAttribute("data-default-wisp");
    if (defaultBare !== null) ele.setAttribute("data-bare", defaultBare);
    if (defaultWisp !== null) ele.setAttribute("data-wisp", defaultWisp);
  }
}
