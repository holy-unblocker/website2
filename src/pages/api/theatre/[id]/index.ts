import { theatreAPI } from "@lib/theatre";
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
