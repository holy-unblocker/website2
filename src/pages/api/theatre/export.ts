import { theatreAPI } from "@lib/theatre";
import { requireTheatreAdmin } from "@lib/admin";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  const entries = await theatreAPI.exportAll();

  return new Response(JSON.stringify(entries, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="theatre.json"',
    },
  });
};
