import {
  createHUDirectClient,
  createHUDataClient,
  resolveLaunchMetadata,
  parseEmulatorType,
  CANONICAL_API_BASE,
  CANONICAL_CDN_BASE,
  type HURoutes,
} from "../browser/client.ts";
import { theatreCategories } from "../../../src/lib/gameCategories.ts";
import { theatreTypes } from "../../../src/lib/TheatreWrapper.ts";
import type {
  HUCatalogClient,
  HUClientConfig,
  TheatreEntry,
  TheatreEntryMin,
  GameLaunchMetadata,
} from "../types/index.ts";

export {
  resolveLaunchMetadata,
  parseEmulatorType,
  createHUDirectClient,
  createHUDataClient,
  CANONICAL_API_BASE,
  CANONICAL_CDN_BASE,
};
export type {
  HUCatalogClient,
  HUClientConfig,
  TheatreEntry,
  TheatreEntryMin,
  GameLaunchMetadata,
};

export function createHUClient(config: HUClientConfig = {}): HUCatalogClient {
  const isRouterMode =
    config.mode === "router" ||
    (typeof config.endpoint === "string" &&
      config.endpoint.startsWith("/") &&
      !config.apiBase &&
      !config.cdnBase);

  if (isRouterMode) {
    const endpoint = config.endpoint ?? config.base ?? "/cdn/";
    const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;

    const routes: HURoutes = {
      queryPath: `${base}query`,
      gamePath: `${base}game`,
      playPath: `${base}play`,
      webretroPath: `${base}html5/webretro/`,
      assetPrefix: `${base}asset/`,
      imagePrefix: `${base}thumbnails/`,
    };

    return createHUDataClient({
      routes,
      categories: theatreCategories,
      types: theatreTypes,
      fetchFn: config.fetch,
    });
  }

  return createHUDirectClient({
    apiBase: config.apiBase ?? config.endpoint ?? CANONICAL_API_BASE,
    cdnBase: config.cdnBase ?? CANONICAL_CDN_BASE,
    categories: theatreCategories,
    types: theatreTypes,
    fetchFn: config.fetch,
    headers: config.headers,
  });
}

export default createHUClient;
