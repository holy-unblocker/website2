# Holy Unblocker SDK

`@holyunblocker/sdk` is the single package every consumer (website2, Abulxt,
or any partner app) uses to read the Holy Unblocker theatre catalog, resolve
launch metadata, and serve theatre assets.

## Surfaces

| Subpath                          | Env          | What it gives you                            |
| :------------------------------- | :----------- | :------------------------------------------- |
| `@holyunblocker/sdk` / `/client` | browser/node | `createHUClient()` catalog client            |
| `@holyunblocker/sdk/server`      | node         | `createHUServerClient()`, `createHURouter()` |
| `@holyunblocker/sdk/router`      | node         | `createHURouter()` (standalone)              |
| `@holyunblocker/sdk/vite`        | node         | `theatreDevPlugin()` for Vite dev servers    |
| `@holyunblocker/sdk/types`       | types        | Shared TypeScript declarations               |
| `@holyunblocker/sdk/constants`   | node         | `theatreCategories`, `theatreTypes`          |

The browser bootstrap is served separately from `GET /cdn/index.js`; browser
pages that are not bundled load that script and use `globalThis.HU`.

## Endpoints (invariants)

All client and SDK code targets **public canonical endpoints only**. Private
cluster/VLAN IPs must never appear in client or SDK code.

- Public REST API: `https://holyunb.locker/v1/games/`
- Public CDN: `https://holyunb.locker/cdn/`

These are exported as constants:

```ts
import { CANONICAL_API_BASE, CANONICAL_CDN_BASE } from "@holyunblocker/sdk";
```

## Catalog client (`createHUClient`)

`createHUClient()` returns a `HUCatalogClient`. It runs in two modes.

### Direct mode (default)

Talks straight to the public API + CDN. Use this from partner apps and any
context that can reach `holyunb.locker`.

```ts
import { createHUClient } from "@holyunblocker/sdk";

const games = createHUClient(); // apiBase/cdnBase default to the public endpoints

const page = await games.query({ sort: "popular", limit: 24 });
const detail = await games.getGame("my46bpy8kd");
```

You can point it at a same-origin reverse proxy instead of the public origin:

```ts
const games = createHUClient({
  apiBase: `${location.origin}/v1/games/`,
  cdnBase: `${location.origin}/cdn/`,
});
```

### Router mode

Set `mode: "router"` (or pass a relative `endpoint`) to read through a mounted
`createHURouter()` on your own server. The client derives opaque routes from
the mount base:

```ts
const games = createHUClient({ mode: "router", endpoint: "/cdn/" });
```

### `HUCatalogClient` API

```ts
games.query(params?, signal?)    -> Promise<ListData>
games.getGames(params?, signal?) -> Promise<ListData>   // alias of query
games.search(text?, signal?)     -> Promise<ListData>
games.getGame(id, signal?)       -> Promise<TheatreEntry | undefined>
games.resolveLaunchMetadata(game) -> GameLaunchMetadata
games.getImageUrl(idOrToken)      -> string
games.countPlay(id)               -> Promise<void>
games.categories                  // readonly, frozen, synchronous
games.types                       // readonly, frozen, synchronous
```

`categories` and `types` are local constants — no network request.

## Server data client (`createHUServerClient`)

`createHUServerClient()` is the trusted, server-only reader. It is intended
for first-party backends (website2) that render pages server-side.

```ts
import { createHUServerClient } from "@holyunblocker/sdk/server";

const games = createHUServerClient({ publicBase: "/cdn/" });
const page = await games.query({ sort: "popular", limit: 24 });
```

Rules:

- `publicBase` is required and must start and end with `/`.
- `endpoint` is optional and defaults to `https://holyunb.locker/api/theatre/`
  (the trusted theatre API, which may include privileged fields).
- `cookie` / `seed` may be supplied to pin the proxy route seed so opaque
  launch tokens sign consistently for the requesting page.
- Because it can reach privileged data, do not wire this client into
  untrusted browser code.

## Router (`createHURouter`)

Mount the router before your app or static handler so it owns the opaque
`/cdn/` browser surface.

```ts
import { createHURouter } from "@holyunblocker/sdk/server";

const huRouter = createHURouter({ mount: "/cdn/" });

server.on("request", (req, res) => {
  if (huRouter.shouldRoute(req)) {
    void huRouter.route(req, res).catch((error) => {
      console.error("HU router failed", error);
      if (!res.headersSent) res.writeHead(502);
      if (!res.writableEnded) res.end();
    });
    return;
  }

  app(req, res);
});
```

The router owns:

- `/cdn/index.js`
- opaque browser query routes
- opaque game detail routes
- opaque play-count routes
- opaque image and local asset routes
- the local webretro mount used by emulator launches

The router must not expose the privileged theatre API to the browser.

## Vite dev plugin (`theatreDevPlugin`)

`@holyunblocker/sdk/vite` consolidates the local CDN static server and the
games-API reverse proxy into one Vite plugin, so any Vite-based partner
project can mount theatre assets without hand-rolled middleware.

```ts
// vite.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { theatreDevPlugin } from "@holyunblocker/sdk/vite";

export default defineConfig({
  plugins: [
    theatreDevPlugin({
      // Serve /cdn/* from a local checkout when the file exists.
      theatreDir: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../theatre/public",
      ),
    }),
  ],
});
```

Behavior:

- `/cdn/*` — served from `theatreDir` when the file exists (with HTTP range
  support and a directory-traversal guard); otherwise streamed from
  `https://holyunb.locker/cdn/`.
- `/v1/games/*` — proxied to `https://holyunb.locker/v1/games/` with
  `Access-Control-Allow-Origin: *`.

Options:

```ts
theatreDevPlugin({
  theatreDir?: string;  // local theatre public/ dir (optional)
  apiBase?: string;     // default "https://holyunb.locker/v1/games/"
  cdnBase?: string;     // default "https://holyunb.locker/cdn/"
})
```

`apiBase` / `cdnBase` must remain public endpoints — never a private VLAN IP.

## Browser bootstrap (`globalThis.HU`)

Pages that are not bundled load the local bootstrap:

```html
<script src="/cdn/index.js"></script>
<script>
  await HU.init({ container: "#games" });
  const page = await HU.query({ sort: "popular", limit: 12 });
  const game = await HU.getGame("my46bpy8kd");
</script>
```

The bootstrap provides `HU.query()`, `HU.getGame()`, `HU.countPlay()`,
`HU.categories`, and `HU.types`.

## Query model

All list reads go through one query object.

```ts
await games.query({ sort: "popular", limit: 24 });
await games.query({ q: "mario", limit: 8 });
await games.query({ category: ["action"] });
await games.query({ type: ["emulator.gba"] });
await games.query({ ids: ["a", "b", "c"] });
await games.query({ sort: "popular", groupBy: "category", limitPerGroup: 15 });
```

Supported fields: `q`, `search`, `sort`, `order`, `limit`, `page`, `offset`,
`groupBy`, `limitPerGroup`, `seed`, `category`, `type`, `ids`, `includeHidden`.

Invalid keys and invalid enum values return `400`.

## Response shape

Public list/detail responses expose descriptive game data:

- `id`, `name`, `category`, `categories`, `type`, `controls`
- `rank` on ordered list results
- `imagePath`, `launchPath`
- `launch` (resolved `GameLaunchMetadata`) once `resolveLaunchMetadata()` is applied

The public list API does not expose raw mirror URLs, internal asset paths, or
exact `plays`. The trusted server client (`createHUServerClient`) may see
additional fields such as `src`, `plays`, and `hidden`.

## Release checks

```sh
npm run build:sdk            # node ./sdk/build.mjs
npm pack --dry-run ./sdk
```

The published tarball is limited to `dist/*` plus `package.json` (the package
`files` field is `["dist"]`). It must not contain browser UI artifacts or
workspace-only runtime files.

## First consumers

- **website2** — `/hub/`, `/hub/all`, `/hub/[id]`, `/hub/apps`,
  `/hub/favorites`, search suggestions, and launch token routing through
  `/cdn/index.js`. Privileged admin routes stay on the internal
  `/api/theatre` APIs via `createHUServerClient()`.
- **Abulxt** — reads the catalog with `createHUClient()` against same-origin
  `/v1/games/` + `/cdn/`, and mounts local theatre assets in dev with
  `theatreDevPlugin()` from `@holyunblocker/sdk/vite`.
