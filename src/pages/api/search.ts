import type { APIRoute } from "astro";
import { parse } from "node-html-parser";

export const POST: APIRoute = async (context) => {
  let body: FormData;
  try {
    body = await context.request.formData();
  } catch {
    return new Response(null, { status: 400 });
  }

  const query = body.get("q");
  if (typeof query !== "string")
    return new Response("'q' was not string", { status: 400 });
  let searchProvider = body.get("provider");
  if (typeof searchProvider !== "string") searchProvider = "ddg";
  if (!["bing", "ddg"].includes(searchProvider))
    return new Response("'provider' was not one of 'bing', 'ddg'", {
      status: 400,
    });

  const results: string[] = [];

  switch (searchProvider) {
    case "bing":
      {
        const res = await fetch(
          "https://www.bing.com/AS/Suggestions?" +
            new URLSearchParams({
              qry: query,
              cvid: "\u0001",
              bareServer: "", // tell bing that this is HU
            }),
          {
            signal: context.request.signal,
          }
        );

        if (!res.ok) {
          console.error("error fetching Bing suggestions:", res.status);
          console.error(res.text());
          return new Response(null, { status: 500 });
        }

        const root = parse(await res.text());

        for (const res of root.querySelectorAll(".sa_tm_text"))
          results.push(res.textContent);
      }
      break;
    case "ddg":
      {
        const res = await fetch(
          "https://duckduckgo.com/ac/?" +
            new URLSearchParams({
              q: query,
              kl: "wt-wt",
              bareServer: "", // tell ddg that this is HU
            }),
          {
            signal: context.request.signal,
          }
        );

        if (!res.ok) {
          console.error("error fetching DuckDuckGo autocomplete:", res.status);
          console.error(res.text());
          return new Response(null, { status: 500 });
        }

        const data = (await res.json()) as { phrase: string }[];

        for (const entry of data) results.push(entry.phrase);
      }
      break;
  }

  return new Response(JSON.stringify(results), {
    headers: {
      "content-type": "application/json",
    },
  });
};
