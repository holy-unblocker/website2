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

declare type CtxUser = import("@lib/models").UserModel & {
  session: import("@lib/models").SessionModel;
};

namespace App {
  interface Locals {
    user?: CtxUser;
    ip: string;
    /**
     * Set or clear the session cookie
     */
    setSession: (secret?: string) => void;
    // helpers for page permissions and redirects
    // for reused code
    acc: {
      /**
       * If the user/request IP is banned
       */
      isBanned: () => Promise<
        | (import("@lib/models").IpBanModel & { type: "ip" })
        | (import("@lib/models").BanModel & { type: "ban" })
        | void
      >;
      /**
       * Redirect the user to the login page
       * Detects the current page and will redirect to it once logged in
       */
      toLogin: () => Response;
      // this is also aware of the url
      toSignup: () => Response;

      toDash: () => Response;
      toBan: () => Response;
      toPricing: () => Response;
      toVerifyEmail: () => Response;
      toVerifyNewEmail: () => Response;
    };
  }
}

declare namespace App {
  interface Locals {
    theme: string;
  }
}

declare var has_serviceworkers: boolean;

declare var db_api: string;
declare var wisp_api: string;
declare var theatre_cdn: string;

// dynamic api for the banner component
interface BannerAPI {
  element: HTMLDivElement;
  get text(): string;
  get mode(): "error" | undefined;
  setError(text: string): void;
  reset(): void;
}

declare var banner: BannerAPI;
