# @holyunblocker/sdk

Server SDK for embedding the Holy Unblocker game hub into your own site. It provides a data client for the readable `/v1/` games API and an HTTP router that serves the browser bootstrap, opaque public routes, and proxy/emulator assets.

Requires Node.js >= 19. ESM only.

## Install

```sh
npm install @holyunblocker/sdk
```

## Surfaces

- **Server package** — imported from `@holyunblocker/sdk` (this package).
- **Browser bootstrap** — served by the router at `GET /cdn/index.js`. It is not importable from npm; browser pages load the local script and use `globalThis.HU`.

## Server usage

```ts
import { createHUServerClient, createHURouter } from "@holyunblocker/sdk";

const games = createHUServerClient({ publicBase: "/cdn/" });
const huRouter = createHURouter({ mount: "/cdn/" });
```

### Data client

```ts
const page = await games.query({ sort: "popular", limit: 24 });
const detail = await games.getGame("example-id");
```

- `publicBase` is required and must start and end with `/`.
- `endpoint` is optional and defaults to `/v1/games/`.
- `/v1/` is server-side only. Browser code must never call it.

### Router

Mount the router ahead of your app or static handler.

```ts
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

The router never exposes `/v1/`.

## Browser usage

```html
<script src="/cdn/index.js"></script>
<script>
  await HU.init({ container: "#games" });
  const page = await HU.query({ sort: "popular", limit: 12 });
  const game = await HU.getGame("example-id");
</script>
```

The bootstrap exposes `HU.query()`, `HU.getGame()`, `HU.countPlay()`, `HU.categories`, and `HU.types`. `HU.categories` and `HU.types` are synchronous frozen values and issue no network request.

## Query model

All list reads go through a single query object.

```ts
await games.query({ sort: "popular", limit: 24 });
await games.query({ q: "mario", limit: 8 });
await games.query({ category: ["action"] });
await games.query({ type: ["emulator.gba"] });
await games.query({ ids: ["a", "b", "c"] });
await games.query({ sort: "popular", groupBy: "category", limitPerGroup: 15 });
```

Supported fields: `q`, `sort`, `order`, `limit`, `page`, `groupBy`, `limitPerGroup`, `seed`, `category`, `type`, `ids`.

Unknown keys and invalid enum values return `400`.

## Response shape

Public list and detail responses expose `id`, `name`, `category`, `categories`, `type`, `controls`, and `rank` on ordered list results.

They never expose raw `src`, mirror URLs, raw asset paths, exact `plays`, or hidden flags.

## Entry points

| Import                         | Contents                             |
| ------------------------------ | ------------------------------------ |
| `@holyunblocker/sdk`           | server client and router             |
| `@holyunblocker/sdk/types`     | TypeScript declarations              |
| `@holyunblocker/sdk/constants` | shared constants (categories, types) |

## Peer dependencies

Proxy and emulator routing rely on Ultraviolet, Scramjet, and the bare-mux transports. They are declared as dependencies and left external in the build, so they resolve from your install tree.

## Building from source

```sh
node ./sdk/build.mjs
npm pack --dry-run ./sdk
```

The published tarball contains only `dist/server/*`, `dist/shared/*`, `dist/types/*`, and `package.json`.

## License

See the repository `LICENSE`.
