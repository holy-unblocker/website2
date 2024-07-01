export function getCookie(name: string) {
  for (const cookie of document.cookie.split("; ")) {
    const n = name + "=";
    if (cookie.startsWith(n)) return cookie.slice(n.length);
  }
}

export function setCookie(name: string, value: string) {
  // 400 days
  const maxAge = 60 * 24 * 400;
  document.cookie = `${name}=${value}; max-age=${maxAge}; samesite=strict; path=/`;
}

export function setTheme(theme: string) {
  setCookie("theme", theme);
}

export function setSearchEngine(searchEngine: number) {
  setCookie("searchEngine", searchEngine.toString());
}
