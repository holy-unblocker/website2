export {
  createHUServerClient,
  type HUClient,
  type HUServerClientConfig,
} from "../../../src/lib/hu.ts";
export {
  createHURouter,
  type HURouter,
  type HURouterConfig,
} from "./router.ts";
export {
  createHUClient,
  createHUDirectClient,
  createHUDataClient,
  resolveLaunchMetadata,
  parseEmulatorType,
  CANONICAL_API_BASE,
  CANONICAL_CDN_BASE,
} from "../client/index.ts";
export type {
  HUCatalogClient,
  HUClientConfig,
  GameLaunchMetadata,
  TheatreEntry,
  TheatreEntryMin,
} from "../types/index.ts";
