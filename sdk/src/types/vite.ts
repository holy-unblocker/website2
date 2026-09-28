/**
 * Type declarations for `@holyunblocker/sdk/vite`.
 *
 * Mirrors the public surface of `src/vite/index.ts`. Kept as a standalone
 * declaration (rather than emitted by tsc) to match how the other SDK types
 * are shipped.
 */

export interface TheatreDevPluginOptions {
  /**
   * Absolute path to the theatre `public/` directory on disk. When a requested
   * `/cdn/*` asset exists here it is served locally (fast, offline-friendly);
   * otherwise the request falls through to the public CDN.
   */
  theatreDir?: string;
  /**
   * Public base for the games REST API. Must stay a public canonical
   * endpoint — never a private VLAN address.
   * @default "https://holyunb.locker/v1/games/"
   */
  apiBase?: string;
  /**
   * Public base for the static CDN upstream used as a fallback for assets not
   * present in `theatreDir`.
   * @default "https://holyunb.locker/cdn/"
   */
  cdnBase?: string;
}

/** Minimal Vite `Plugin` structural type (avoids a hard vite dependency). */
export interface TheatreDevPlugin {
  name: string;
  configureServer: (server: unknown) => void;
}

export declare function theatreDevPlugin(
  options?: TheatreDevPluginOptions,
): TheatreDevPlugin;

export default theatreDevPlugin;
