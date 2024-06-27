/// <reference types="astro/client" />
/// <reference types="@titaniumnetwork-dev/ultraviolet/client" />

declare module "*.svg?svgmin" {
  import type { HTMLAttributes } from "astro/types";

  const component: (
    props: HTMLAttributes<"svg">
  ) => astroHTML.JSX.DefinedIntrinsicElements["svg"];

  export default component;
}

declare module "*.svg?react" {
  const SVG: string;
  export default SVG;
}

declare module "*/i18n?min" {
  export * from "@lib/i18n";
}

declare var setNavExpanded: (expanded: boolean) => void;

declare namespace App {
  interface Locals {
    theme: string;
  }
}

declare var has_serviceworkers: boolean;

declare var db_api: string;
declare var wisp_api: string;
declare var theatre_cdn: string;
