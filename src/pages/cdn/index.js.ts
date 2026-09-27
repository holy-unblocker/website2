import { buildHUBrowserBootstrap } from "@lib/huRouter.js";
import type { APIRoute } from "astro";

// Dev-mode twin of the runtime's HU bootstrap route (in production the node
// runtime intercepts /cdn/index.js before astro sees it). Bakes the
// request's seed-derived opaque API routes into the browser client so no
// /v1/ or /v2/ path is ever exposed to it.
export const GET: APIRoute = ({ locals }) => {
  return new Response(buildHUBrowserBootstrap(locals.proxyRoutes.hu), {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
};
