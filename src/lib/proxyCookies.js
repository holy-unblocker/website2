// Cookie names and value codes for the proxy settings.
//
// Cookies ride on every request and come back in Set-Cookie on every response
// (the middleware re-sets them), and browser extensions read them, so neither a
// name nor a value may name the proxy: no "wispServer", no "trans=epoxy". The
// server (middleware.ts) and the client (cookies.ts) both go through this
// module. Client-safe: no node imports.

export const relayCookies = { bare: "ra", wisp: "rb" };
export const transportCookie = "trans";
export const engineCookie = "engine";

// Names and values used before the rename; read once, then rewritten.
export const legacyRelayCookies = { bare: "bareServer", wisp: "wispServer" };

const transportCodes = { epoxy: "e", bare: "b" };
const engineCodes = { uv: "1", sj: "2" };

function decodeWith(codes, value) {
  if (typeof value !== "string") return undefined;
  for (const [name, code] of Object.entries(codes))
    if (value === code || value === name) return name;
  return undefined;
}

export const encodeTransport = (transport) => transportCodes[transport];
export const decodeTransport = (value) => decodeWith(transportCodes, value);
export const encodeEngine = (engine) => engineCodes[engine];
export const decodeEngine = (value) => decodeWith(engineCodes, value);

// A relay URL is stored as unpadded base64url of its UTF-8 bytes.
export function encodeRelay(url) {
  let binary = "";
  for (const byte of new TextEncoder().encode(url))
    binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeRelay(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value))
    return undefined;
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}
