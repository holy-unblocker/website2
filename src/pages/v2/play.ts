import { theatrePlayCountingEnabled } from "@config/apis";
import { dbEnabled, theatreAPI, theatreAPIMirror } from "@lib/theatre";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : undefined;
  if (!id) {
    return new Response(JSON.stringify({ message: "Missing game id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!theatrePlayCountingEnabled)
    return new Response(JSON.stringify({}), {
      headers: { "content-type": "application/json" },
    });

  const ok = dbEnabled
    ? await theatreAPI.countPlay(id)
    : await theatreAPIMirror
        .plays(id)
        .then(() => true)
        .catch(() => false);
  if (!ok) return new Response(null, { status: 404 });

  return new Response(JSON.stringify({}), {
    headers: {
      "content-type": "application/json",
    },
  });
};
