import { theatreAPI } from "@lib/theatre";
import type { ListAPIQuery, ListOptions } from "@lib/TheatreAPI";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const q: ListOptions = {};

  const query = Object.fromEntries(url.searchParams) as ListAPIQuery;

  if (typeof query.search === "string") q.search = query.search;
  if (typeof query.order === "string") q.order = query.order;
  if (typeof query.sort === "string") q.sort = query.sort;
  if (typeof query.limit === "string")
    if (isNaN((q.limit = parseInt(query.limit)))) delete q.limit;
  if (typeof query.offset === "string")
    if (isNaN((q.offset = parseInt(query.offset)))) delete q.offset;
  if (typeof query.limitPerCategory === "string")
    if (isNaN((q.limitPerCategory = parseInt(query.limitPerCategory))))
      delete q.limitPerCategory;
  if (typeof query.category === "string")
    q.category = query.category.split(",");
  if (typeof query.ids === "string") q.ids = query.ids.split(",");

  const data = await theatreAPI.list(q);

  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
    },
  });
};
