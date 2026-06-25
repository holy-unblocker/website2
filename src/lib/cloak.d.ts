export interface AppCloak {
  icon: string;
  title: string;
  url: string;
}

export declare const randomCloaks: (string | AppCloak)[];

/**
 * Load the pre-fetched built-in cloaks from cloak/builtins.json. Cached after
 * the first read. Returns an empty array if the cache file is missing.
 */
export declare function getBuiltinCloaks(): Promise<AppCloak[]>;

export declare function getRandomCloak(): Promise<AppCloak | undefined>;

/**
 * Parse already-fetched HTML into cloak data. `finalUrl` is the post-redirect
 * URL the HTML came from (used to resolve relative icon hrefs and as the cloak
 * url).
 */
export declare function parseCloakData(
  html: string,
  finalUrl: string,
): AppCloak;

export declare function extractCloakData(address: string): Promise<AppCloak>;
