import { compatAPI } from "@lib/db";
import { parse } from "effective-domain-name-parser";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params }) => {
  const parsed = parse(params.host!);
  const compat = await compatAPI.show(`${parsed.sld}.${parsed.tld}`);

  if (!compat)
    return new Response("{}", {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    });

  return new Response(JSON.stringify(compat), {
    headers: {
      "content-type": "application/json",
    },
  });
};
