# Holy Unblocker SDK

## What ships

The SDK has two surfaces:

- a **server package** published as `@holyunblocker/sdk`
- a **browser bootstrap** served locally from `GET /cdn/index.js`

The browser runtime is not imported from npm. Browser pages must load the local script and use `globalThis.HU`.

## Server usage

```ts
import { createHUServerClient, createHURouter } from "@holyunblocker/sdk";

const games = createHUServerClient({ publicBase: "/cdn/" });
const huRouter = createHURouter({ mount: "/cdn/" });
```

### Server data client

`createHUServerClient()` reads from the readable `/v1/` API.

```ts
const games = createHUServerClient({ publicBase: "/cdn/" });

const page = await games.query({
  sort: "popular",
  limit: 24,
});

const detail = await games.getGame("example-id");
```

Rules:

- `publicBase` is required
- `publicBase` must start and end with `/`
- `endpoint` is optional and defaults to `/v1/games/`
- server code may call `/v1/`
- browser code must not call `/v1/`

### Router usage

Mount the router before your app or static handler.

```ts
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

The router must not expose `/v1/`.

## Browser usage

Load the local bootstrap:

```html
<script src="/cdn/index.js"></script>
<script>
  await HU.init({ container: "#games" });
  const page = await HU.query({ sort: "popular", limit: 12 });
  const game = await HU.getGame("example-id");
</script>
```

The bootstrap provides:

- `HU.query()`
- `HU.getGame()`
- `HU.countPlay()`
- `HU.categories`
- `HU.types`

`HU.categories` and `HU.types` are synchronous, frozen values. They do not issue a network request.

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

Supported fields:

- `q`
- `sort`
- `order`
- `limit`
- `page`
- `groupBy`
- `limitPerGroup`
- `seed`
- `category`
- `type`
- `ids`

Invalid keys and invalid enum values return `400`.

## Public response shape

Public list/detail responses expose descriptive game data:

- `id`
- `name`
- `category`
- `categories`
- `type`
- `controls`
- `rank` on ordered list results

Public responses do not expose:

- raw `src`
- mirror URLs
- raw asset paths
- exact `plays`
- hidden flags

## Release checks

Build and pack checks:

```sh
npm run build
npm pack --dry-run ./sdk
```

Expected package contents are limited to:

- `dist/server/*`
- `dist/shared/*`
- `dist/types/*`
- `package.json`

The tarball must not contain browser UI artifacts or workspace-only runtime files.

## Website2 first-consumer notes

Current public website2 routes use the SDK surfaces for:

- `/hub/`
- `/hub/all`
- `/hub/[id]`
- `/hub/apps`
- `/hub/favorites`
- search suggestions
- launch token routing through `/cdn/index.js`

Privileged admin routes remain on the internal `/api/theatre` APIs.
