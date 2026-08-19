import { theatreCategories } from "@lib/gameCategories";
import { dbEnabled, theatreAPI, theatreAPIMirror } from "@lib/theatre";
import { huQueryErrorResponse, parseHUListQuery } from "@lib/huQuery";
import { toPublicGameMin } from "@lib/huPublic";
import { createHUImagePath, createHULaunchPath } from "@lib/proxyRoutes.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  let options;
  try {
    options = parseHUListQuery(url.searchParams, locals.user?.admin === true);
  } catch (error) {
    return huQueryErrorResponse(error);
  }

  const api = dbEnabled ? theatreAPI : theatreAPIMirror;

  if (options.groupBy === "category") {
    const groups = (
      await Promise.all(
        theatreCategories.map(async (category) => {
          const result = await api.list({
            ...options,
            category: [category.id],
            groupBy: undefined,
            limitPerGroup: undefined,
            limit: options.limitPerGroup,
            offset: undefined,
            page: undefined,
          });
          if (result.entries.length === 0) return null;
          return {
            key: category.id,
            label: category.name,
            games: result.entries.map((entry, index) => ({
              ...toPublicGameMin(entry, index + 1),
              imagePath: createHUImagePath(locals.proxyRoutes, entry.id),
              launchPath: createHULaunchPath(locals.proxyRoutes, entry.id),
            })),
            total: result.total,
          };
        }),
      )
    ).filter(Boolean);

    return new Response(JSON.stringify({ groups }), {
      headers: {
        "content-type": "application/json",
      },
    });
  }

  const data = await api.list(options);
  const games = data.entries.map((entry, index) => ({
    ...toPublicGameMin(entry, index + 1),
    imagePath: createHUImagePath(locals.proxyRoutes, entry.id),
    launchPath: createHULaunchPath(locals.proxyRoutes, entry.id),
  }));
  const limit =
    typeof options.limit === "number"
      ? options.limit
      : Math.max(games.length, 1);
  const page =
    Math.floor(
      (typeof options.offset === "number" ? options.offset : 0) / limit,
    ) + 1;
  const pages = data.total === 0 ? 0 : Math.ceil(data.total / limit);

  return new Response(
    JSON.stringify({
      total: data.total,
      page,
      pages,
      entries: games,
      games,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  );
};
