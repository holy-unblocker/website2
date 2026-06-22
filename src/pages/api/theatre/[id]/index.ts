import { theatreAPI } from "@lib/theatre";
import { requireTheatreAdmin } from "@lib/admin";
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

export const PATCH: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  try {
    const body = await context.request.json();

    const entry = await theatreAPI.update(
      context.params.id!,
      body.name,
      body.type,
      body.src,
      body.category,
      body.controls,
      typeof body.plays === "number" ? body.plays : undefined,
      typeof body.hidden === "boolean" ? body.hidden : undefined,
    );

    if (!entry) return new Response(null, { status: 404 });

    return new Response(JSON.stringify(entry), {
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

export const DELETE: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  if (!(await theatreAPI.delete(context.params.id!)))
    return new Response(null, { status: 404 });

  return new Response(JSON.stringify({}), {
    headers: { "content-type": "application/json" },
  });
};
