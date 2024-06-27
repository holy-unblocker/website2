import engines from "@lib/engines";

function getCookie(name: string, defaultValue?: string) {
  for (const cookie of document.cookie.split("; ")) {
    const c = cookie.split("=");
    if (name === c[0]) return c[1];
  }

  return defaultValue;
}

const maxAge = 60 * 24 * 400;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; max-age=${maxAge}; samesite=strict; path=/`;
}

export function getTheme() {
  return getCookie("theme");
}

export function setTheme(theme: string) {
  setCookie("theme", theme);
}

export function getSearchEngine() {
  return Number(getCookie("searchEngine", "1"));
}

export function setSearchEngine(searchEngine: number) {
  setCookie("searchEngine", searchEngine.toString());
}
