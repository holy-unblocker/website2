import type { APIRoute } from "astro";
import {
  proxyAssetResponse,
  staticAssetResponse,
} from "@lib/proxyAssetResponse";

function notFound() {
  return new Response(null, { status: 404 });
}

export const GET: APIRoute = async ({ locals, params, url }) => {
  const name = params.name;
  if (!name) return notFound();

  const routes = locals.proxyRoutes;
  const pathname = `/${name}`;

  const asset = await proxyAssetResponse(pathname, routes);
  if (asset) return asset;

  if (url.pathname.startsWith(routes.paths.uvService)) return notFound();
  if (url.pathname.startsWith(routes.paths.scramService)) return notFound();

  const staticFile = await staticAssetResponse(pathname);
  if (staticFile) return staticFile;

  return notFound();
};
