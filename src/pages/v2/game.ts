import { dbEnabled, theatreAPI, theatreAPIMirror } from "@lib/theatre";
import { toPublicGame } from "@lib/huPublic";
import {
  createHUAssetPath,
  createHUImagePath,
  createHULaunchPath,
} from "@lib/proxyRoutes.js";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : undefined;
  if (!id) {
    return new Response(JSON.stringify({ message: "Missing game id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const api = dbEnabled ? theatreAPI : theatreAPIMirror;
  const entry = await api.show(id);

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
