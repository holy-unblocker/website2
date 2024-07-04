import type { APIRoute } from "astro";

export const GET: APIRoute = (context) => {
  return context.redirect("/sub/tiers", 301);
};
