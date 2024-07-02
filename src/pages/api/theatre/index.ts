import { theatreAPI } from "@lib/theatre";
import type { ListData, ListOptions } from "@lib/TheatreAPI";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const q: ListOptions = {};

  if (url.searchParams.has("leastGreatest")) {
    q.leastGreatest = url.searchParams.get("leastGreatest") === "true";
  }
  if (url.searchParams.get("sort")) {
    const sortType = url.searchParams.get("sort")!;
    q.sort = sortType as ListOptions["sort"];
  }
  if (url.searchParams.has("reverse")) {
    q.reverse = url.searchParams.get("reverse") === "true";
  }
  if (url.searchParams.has("limit")) {
    const limit = parseInt(url.searchParams.get("limit")!);
    if (!isNaN(limit) && limit >= 0) q.limit = limit;
  }
  if (url.searchParams.has("offset")) {
    const offset = parseInt(url.searchParams.get("offset")!);
    if (!isNaN(offset) && offset >= 0) q.offset = offset;
  }
  if (url.searchParams.has("limitPerCategory")) {
    const limitPerCategory = Number(url.searchParams.get("limitPerCategory"));
    if (!isNaN(limitPerCategory)) q.limitPerCategory = limitPerCategory;
  }
  if (url.searchParams.has("search")) {
    q.search = url.searchParams.get("search")!;
  }
  if (url.searchParams.has("category")) {
    q.category = url.searchParams.get("category")!.split(",");
  }
  if (url.searchParams.has("ids")) {
    q.ids = url.searchParams.get("ids")!.split(",");
  }

  const data = await theatreAPI.list(q);

  const send = {
    entries: [],
    total: data.total,
  } as ListData;

  for (const entry of data.entries)
    send.entries.push({
      name: entry.name,
      id: entry.id,
      category: entry.category,
    });

  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
    },
  });
};
