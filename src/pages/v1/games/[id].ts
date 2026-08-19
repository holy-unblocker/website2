import { dbEnabled, theatreAPI, theatreAPIMirror } from "@lib/theatre";
import { toPublicGame } from "@lib/huPublic";
import {
  createHUAssetPath,
  createHUImagePath,
  createHULaunchPath,
} from "@lib/proxyRoutes.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, locals }) => {
  const api = dbEnabled ? theatreAPI : theatreAPIMirror;
  const entry = await api.show(params.id!);

  if (!entry || entry.hidden) return new Response(null, { status: 404 });

  return new Response(
    JSON.stringify({
      ...toPublicGame(entry),
      imagePath: createHUImagePath(locals.proxyRoutes, entry.id),
      launchPath: createHULaunchPath(locals.proxyRoutes, entry.id),
      assetPath: entry.src.startsWith("./")
        ? createHUAssetPath(locals.proxyRoutes, entry.src)
        : undefined,
      playerPath: entry.type.startsWith("emulator")
        ? locals.proxyRoutes.hu.webretroPath
        : undefined,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  );
};
