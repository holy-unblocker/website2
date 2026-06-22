import { theatrePlayCountingEnabled } from "@config/apis";
import { theatreAPI } from "@lib/theatre";
import type { APIRoute } from "astro";

export const PUT: APIRoute = async ({ params }) => {
  if (!theatrePlayCountingEnabled)
    return new Response(JSON.stringify({}), {
      headers: {
        "content-type": "application/json",
      },
    });

  if (!(await theatreAPI.countPlay(params.id!)))
    return new Response(null, { status: 404 });

  return new Response(JSON.stringify({}), {
    headers: {
      "content-type": "application/json",
    },
  });
};
