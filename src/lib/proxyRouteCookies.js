// Client-safe proxy route cookie constants.
// Kept separate from proxyRoutes.js so browser bundles can import these
// without pulling in that module's node-only dependencies.

export const proxyRouteCookie = "re";
export const proxyRouteCookieMaxAge = 60 * 60 * 24 * 400;

export const torCookie = "t";
export const torCookieMaxAge = 60 * 60 * 24 * 400;
