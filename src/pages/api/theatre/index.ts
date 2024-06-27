import type { ListOptions, TheatreEntry } from "@lib/TheatreWrapper";
import { theatreAPI } from "@lib/db";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const q: ListOptions = {};

  if (url.searchParams.has("leastGreatest")) {
    q.leastGreatest = url.searchParams.get("leastGreatest") === "true";
  }
  if (url.searchParams.get("sort")) {
    const sortType = url.searchParams.get("sort")!;
    if (["name", "plays", "search"].includes(sortType)) {
      q.sort = sortType as ListOptions["sort"];
    } else {
      throw new Error(`Invalid sort parameter: ${sortType}`);
    }
  }
  if (url.searchParams.has("reverse")) {
    q.reverse = url.searchParams.get("reverse") === "true";
  }
  if (url.searchParams.has("limit")) {
    const limit = Number(url.searchParams.get("limit"));
    if (!isNaN(limit)) q.limit = limit;
  }
  if (url.searchParams.has("offset")) {
    const offset = Number(url.searchParams.get("offset"));
    if (!isNaN(offset)) q.offset = offset;
  }
  if (url.searchParams.has("limitPerCategory")) {
    const limitPerCategory = Number(url.searchParams.get("limitPerCategory"));
    if (!isNaN(limitPerCategory)) q.limitPerCategory = limitPerCategory;
  }
  if (url.searchParams.has("search")) {
    q.search = url.searchParams.get("search")!;
  }
  if (url.searchParams.has("category")) {
    q.category = url.searchParams.get("category")!;
  }

  const data = await theatreAPI.list(q);

  const send = {
    entries: [] as {
      name: TheatreEntry["name"];
      id: TheatreEntry["id"];
      category: TheatreEntry["category"];
    }[],
    total: data.total,
  };

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
