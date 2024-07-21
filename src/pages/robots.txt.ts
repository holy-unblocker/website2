import type { APIRoute } from "astro";

export const GET: APIRoute = ({ locals }) => {
  const txt = locals.isMainWebsite
    ? `User-agent: *
Disallow: /uv/
Disallow: /cdn/
Disallow: /api/`
    : `User-agent: *
Disallow: /`;

  return new Response(txt, {
    headers: {
      "content-type": "text/plain",
    },
  });
};
