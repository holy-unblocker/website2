import { theatreCategories } from "./gameCategories.ts";
import { theatreTypes } from "./TheatreWrapper.ts";
import type { ListAPIQuery, ListOptions } from "./TheatreAPI.ts";

const allowedKeys = new Set([
  "q",
  "search",
  "order",
  "sort",
  "limit",
  "page",
  "offset",
  "limitPerGroup",
  "groupBy",
  "seed",
  "category",
  "type",
  "ids",
  "includeHidden",
]);
const sortValues = new Set([
  "index",
  "name",
  "plays",
  "popular",
  "new",
  "relevance",
  "random",
]);
const orderValues = new Set(["asc", "desc"]);
const categoryValues = new Set(
  theatreCategories.map((category) => category.id),
);
const typeValues = new Set(theatreTypes);

export class HUQueryError extends Error {
  status = 400;
}

function parsePositiveInt(key: string, value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new HUQueryError(`${key} must be a positive integer.`);
  return parsed;
}

function parseStringList(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const list = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length === 0 ? undefined : list;
}

function keys(query: URLSearchParams | ListAPIQuery) {
  if (query instanceof URLSearchParams) return [...query.keys()];
  return Object.keys(query);
}

export function parseHUListQuery(
  query: URLSearchParams | ListAPIQuery,
  includeHidden = false,
): ListOptions {
  for (const key of keys(query)) {
    if (!allowedKeys.has(key))
      throw new HUQueryError(`Unknown query key: ${key}`);
  }

  const get =
    query instanceof URLSearchParams
      ? (key: keyof ListAPIQuery) => query.get(key)
      : (key: keyof ListAPIQuery) => {
          const value = query[key];
          return typeof value === "string" ? value : undefined;
        };

  const options: ListOptions = {};

  const q = get("q");
  const search = get("search");
  const normalizedSearch = typeof q === "string" ? q : search;
  if (typeof normalizedSearch === "string") {
    options.q = normalizedSearch;
    options.search = normalizedSearch;
  }

  const sort = get("sort");
  if (typeof sort === "string") {
    if (!sortValues.has(sort))
      throw new HUQueryError(`Unsupported sort: ${sort}`);
    options.sort =
      sort === "popular" ? "plays" : sort === "new" ? "index" : sort;
  } else {
    options.sort = typeof normalizedSearch === "string" ? "relevance" : "plays";
  }

  const order = get("order");
  if (typeof order === "string") {
    if (!orderValues.has(order))
      throw new HUQueryError(`Unsupported order: ${order}`);
    options.order = order;
  } else {
    options.order = "desc";
  }

  const limit = parsePositiveInt("limit", get("limit"));
  if (typeof limit === "number") options.limit = limit;

  const page = parsePositiveInt("page", get("page"));
  if (typeof page === "number") {
    if (page < 1) throw new HUQueryError("page must be at least 1.");
    options.page = page;
  }

  const offset = parsePositiveInt("offset", get("offset"));
  if (typeof offset === "number") options.offset = offset;

  const limitPerGroup = parsePositiveInt("limitPerGroup", get("limitPerGroup"));
  if (typeof limitPerGroup === "number") {
    options.limitPerGroup = limitPerGroup;
  }

  const category = parseStringList(get("category"));
  if (category) {
    for (const value of category) {
      if (!categoryValues.has(value))
        throw new HUQueryError(`Unknown category: ${value}`);
    }
    options.category = category;
  }

  const ids = parseStringList(get("ids"));
  if (ids) options.ids = ids;

  const type = parseStringList(get("type" as keyof ListAPIQuery));
  if (type) {
    for (const value of type) {
      if (!typeValues.has(value))
        throw new HUQueryError(`Unknown type: ${value}`);
    }
    options.type = type;
  }

  const groupBy = get("groupBy");
  if (typeof groupBy === "string") {
    if (groupBy !== "category")
      throw new HUQueryError(`Unsupported groupBy: ${groupBy}`);
    options.groupBy = groupBy;
    if (typeof options.limitPerGroup !== "number") {
      throw new HUQueryError("limitPerGroup is required when groupBy is set.");
    }
    if (
      typeof options.limit === "number" ||
      typeof options.offset === "number" ||
      typeof options.page === "number"
    ) {
      throw new HUQueryError(
        "page, limit, and offset cannot be used with groupBy.",
      );
    }
  } else if (typeof options.limitPerGroup === "number") {
    throw new HUQueryError("groupBy is required when limitPerGroup is set.");
  }

  const seed = get("seed");
  if (typeof seed === "string") options.seed = seed;

  if (options.sort === "relevance" && typeof options.search !== "string") {
    throw new HUQueryError("sort=relevance requires q or search.");
  }

  if (includeHidden && get("includeHidden") === "true") {
    options.includeHidden = true;
  }

  if (typeof options.page === "number" && typeof options.offset !== "number") {
    const pageSize = typeof options.limit === "number" ? options.limit : 24;
    options.offset = (options.page - 1) * pageSize;
  }

  return options;
}

export function huQueryErrorResponse(error: unknown) {
  if (!(error instanceof HUQueryError)) throw error;
  return new Response(JSON.stringify({ message: error.message }), {
    status: error.status,
    headers: { "content-type": "application/json" },
  });
}
