/// <reference types="astro/client" />
/// <reference types="@titaniumnetwork-dev/ultraviolet/client" />

declare module "*.svg?react" {
  const SVG: string;
  export default SVG;
}

declare module "*/i18n?min" {
  export * from "@lib/i18n";
}

declare var setInputFocused: (newFocused: boolean) => void;

declare var setNavExpanded: (expanded: boolean) => void;

declare type CtxUser = import("@lib/models").UserModel & {
  session: import("@lib/models").SessionModel;
};

type ServiceFrameSrc = [src: string, uvPage: string];

// setting to undefined closes the ServicEFrame
declare var setServiceSrc: (src?: string | null) => Promise<void> | void;

namespace App {
  interface Locals {
    isMainWebsite: boolean;

    // unique encryption key
    clientKey: string;
    encryptText: (data: string) => Promise<string>;

    // obfus: import("@lib/Obfuscator").default;

    theme: string;
    // returns true if theme is "day" or "night", false if invalid
    setTheme: (newTheme?: string | null) => boolean;
    wispServer: string;
    // returns true if valid wisp server url, false if invalid
    setWispServer: (newWispServer?: string | null) => boolean;
    proxyMode: string;
    setProxyMode: (newProxyMode?: string | null) => boolean;
    searchEngine: number;
    setSearchEngine: (newSearchEngine?: string | number | null) => boolean;
    cloak?: import("@lib/cloak").AppCloak;
    // returns true if valid cloak data, false if invalid
    setCloak: (cloak?: import("@lib/cloak").AppCloak | null) => boolean;

    // contains a semi-accurate protocol and hostname
    origin: string;

    user?: CtxUser;
    ip: string;
    /**
     * Set or clear the session cookie
     * returns true if valid session data, false if invalid
     */
    setSession: (
      secret?: string | null,
      staySignedIn: boolean = true
    ) => boolean;
    // helpers for page permissions and redirects
    // for reused code
    acc: {
      isPremium: () => boolean;
      /**
       * If the user/request IP is banned
       */
      isBanned: () => Promise<import("@lib/models").BanModel | void>;
      needsToVerifyTotp: () => boolean;
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
      toVerifyTotp: () => Response;
    };
  }
}

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
