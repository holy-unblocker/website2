import type { APIRoute } from "astro";
import { appConfig } from "@config/config";

const GOOGLE_CERTIFICATION_ID = "f08c47fec0942fa0";

export const GET: APIRoute = ({ locals }) => {
  if (!locals.isMainWebsite || !appConfig.adsenseClient) {
    return new Response("", {
      headers: {
        "content-type": "text/plain",
      },
    });
  }

  const publisherId = appConfig.adsenseClient.replace(/^ca-/, "");

  const txt = `google.com, ${publisherId}, DIRECT, ${GOOGLE_CERTIFICATION_ID}`;

  return new Response(txt, {
    headers: {
      "content-type": "text/plain",
    },
  });
};
