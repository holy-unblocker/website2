export function getCookie(name: string, defaultValue?: string) {
  for (const cookie of document.cookie.split("; ")) {
    const c = cookie.split("=");
    if (name === c[0]) return c[1];
  }

  return defaultValue;
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
