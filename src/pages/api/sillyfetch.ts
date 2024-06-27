import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const url = await request.text();

  const res = await fetch(url, { redirect: "follow" });

  return new Response(res.body, {
    headers: {
      "x-url": res.url,
    },
  });
};
