import type { AppCloak } from "./cloak";

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

export function setWispServer(wispServer: string) {
  setCookie("wispServer", wispServer);
}
