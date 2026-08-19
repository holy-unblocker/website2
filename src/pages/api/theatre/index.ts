import { theatreAPI } from "@lib/theatre";
import { requireTheatreAdmin } from "@lib/admin";
import { parseHUListQuery } from "@lib/huQuery";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  const { url, locals } = context;
  const data = await theatreAPI.list(
    parseHUListQuery(url.searchParams, locals.user?.admin === true),
  );

  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
    },
  });
};

export const POST: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  try {
    const body = await context.request.json();
    const entry = await theatreAPI.create(
      body.name,
      body.type,
      body.src,
      body.category,
      body.controls,
      typeof body.plays === "number" ? body.plays : undefined,
      typeof body.hidden === "boolean" ? body.hidden : undefined,
    );

    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        message: err instanceof Error ? err.message : "Invalid theatre entry",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
};
