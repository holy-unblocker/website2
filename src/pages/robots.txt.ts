import type { APIRoute } from "astro";

export const GET: APIRoute = ({ url, locals }) => {
  const txt = locals.isMainWebsite
    ? `User-agent: *
Allow: /
Disallow: /~/
Disallow: /uv/
Disallow: /cdn/
Disallow: /api/
Sitemap: https://${url.host}/sitemap-index.xml`
    : `User-agent: *
Disallow: /`;

  return new Response(txt, {
    headers: {
      "content-type": "text/plain",
    },
  });
};
