import type { APIRoute } from "astro";

// we are redirected here after payment is complete
export const GET: APIRoute = async (context) => {
  // start the payment period
  const session_id = context.url.searchParams.get("session_id");
  if (session_id === null) return new Response("wut", { status: 400 });

  console.log("got session from redirect", session_id);

  return context.redirect("/pro/dashboard", 302);
};
