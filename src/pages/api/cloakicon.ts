import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
  const url = decodeURIComponent(context.url.search.slice(1));
  if (url === "") return new Response(null, { status: 404 });
  const res = await fetch(url, { redirect: "follow" });
  const headers = new Headers();
  headers.set("cache-control", "public, max-age=31536000");
  const ct = res.headers.get("content-type");
  if (typeof ct === "string") headers.set("content-type", ct);
  return new Response(res.body, {
    headers,
  });
};
