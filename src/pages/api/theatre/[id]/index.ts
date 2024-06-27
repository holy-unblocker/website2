import { theatreAPI } from "@lib/db";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params }) => {
  const entry = await theatreAPI.show(params.id!);

  if (!entry) return new Response(null, { status: 404 });

  return new Response(JSON.stringify(entry), {
    headers: {
      "content-type": "application/json",
    },
  });
};
