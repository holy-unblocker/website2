import type { APIRoute } from "astro";

export const GET: APIRoute = ({ locals }) => {
  if (!locals.isMainWebsite) return new Response(null, { status: 404 });

  return new Response(
    JSON.stringify({
      name: "Holy Unblocker",
      short_name: "Holy UB",
      start_url: "/",
      display: "standalone",
      background_color: "#2e3440",
      theme_color: "#2e3440",
      description:
        "Holy Unblocker is a web proxy service with support for many sites. Unblock websites on Chromebooks at school and work for free!",
      icons: [
        {
          src: "/h.ico",
          sizes: "32x32",
          type: "image/vnd.microsoft.icon",
        },
        {
          src: "/favicon.svg",
          sizes: "any",
          type: "image/svg+xml",
        },
        {
          src: "/favicon-128.png",
          sizes: "128x128",
          type: "image/png",
        },
        {
          src: "/favicon-mask-128.png",
          sizes: "128x128",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/favicon-mask.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "maskable",
        },
      ],
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    }
  );
};
