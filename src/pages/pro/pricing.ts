import type { APIRoute } from "astro";

export const GET: APIRoute = (context) => {
  return context.redirect("/pro/tiers", 301);
};
