import { installHU } from "./client.ts";

declare const __HU_ROUTES__: {
  queryPath: string;
  gamePath: string;
  playPath: string;
  webretroPath: string;
  assetPrefix: string;
  imagePrefix: string;
};

declare const __HU_CATEGORIES__: Array<{ id: string; name: string }>;
declare const __HU_TYPES__: string[];

installHU({
  routes: __HU_ROUTES__,
  categories: __HU_CATEGORIES__,
  types: __HU_TYPES__,
});
