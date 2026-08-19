# Astro SDK Example

## Goal

This example shows the intended boundary for Astro:

- server code imports `createHUServerClient()` from `@holyunblocker/sdk`
- server middleware mounts `createHURouter()` for `/cdn/`
- browser code loads `/cdn/index.js`
- browser code uses `globalThis.HU`
- browser code does not import the npm runtime

## Server setup

```ts
import { createHUServerClient, createHURouter } from "@holyunblocker/sdk";

export const games = createHUServerClient({
  publicBase: "/cdn/",
});

export const huRouter = createHURouter({
  mount: "/cdn/",
});
```

## Node request wiring

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

## Astro page

```astro
---
import { games } from "../lib/hu";

const page = await games.query({
  sort: "popular",
  limit: 24,
});
---

<script src="/cdn/index.js"></script>
<ul>
  {page.entries.map((game) => (
    <li>
      <a href={game.launchPath}>{game.name}</a>
    </li>
  ))}
</ul>
```

## Browser-side use

```html
<script src="/cdn/index.js"></script>
<script>
  const page = await HU.query({ q: "mario", limit: 8 });
  console.log(HU.categories, HU.types);
</script>
```

## Rules

- use `/v1/` only from server/build code
- mount the router before static handlers
- never import `@holyunblocker/sdk` runtime into browser code
- use `import type` from `@holyunblocker/sdk/types` if needed
