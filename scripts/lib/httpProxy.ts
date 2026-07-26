// Optional HTTP proxy support for outbound fetches (ported from bigame).
//
// Node's built-in fetch (undici) does NOT read HTTP_PROXY/HTTPS_PROXY env vars
// automatically. This builds an undici ProxyAgent from those vars once, so
// outbound requests (eg. Bing image search + image downloads) can be routed
// through a proxy to avoid rate-limiting/blocking from a single IP on bulk runs.
//
// When no proxy env var is set, getProxyDispatcher() returns undefined and
// callers fall back to the default global dispatcher (undici ignores an
// undefined dispatcher).
import { ProxyAgent } from "undici";

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

let dispatcher: ProxyAgent | undefined;
if (proxyUrl) dispatcher = new ProxyAgent(proxyUrl);

/** the configured proxy url, or undefined when none is set */
export const httpProxyUrl = proxyUrl;

/**
 * Returns an undici dispatcher routing through the configured HTTP proxy, or
 * undefined when no proxy is set. Pass the result as the `dispatcher` option to
 * fetch(); undici ignores an undefined dispatcher.
 */
export function getProxyDispatcher(): ProxyAgent | undefined {
  return dispatcher;
}
