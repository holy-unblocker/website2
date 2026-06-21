import { theatreAPI } from "@lib/theatre";
import { requireTheatreAdmin } from "@lib/admin";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  try {
    const body = await context.request.json();

    // accept either a bare array or { entries, prune }
    const entries = Array.isArray(body) ? body : body.entries;
    const prune = Array.isArray(body) ? false : body.prune === true;

    if (!Array.isArray(entries))
      return new Response(
        JSON.stringify({ message: "Expected a JSON array of entries." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );

    const result = await theatreAPI.importEntries(entries, prune);

    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        message: err instanceof Error ? err.message : "Invalid import data",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
};
