# Website2 SDK Migration

## Scope

This document tracks the first-consumer migration from legacy public theatre reads to the SDK surfaces.

## Migrated public routes

- `/hub/`
- `/hub/all`
- `/hub/[id]`
- `/hub/apps`
- `/hub/favorites`
- search suggestions
- launch token flow through `/cdn/index.js`

## Public surface now used

### Server-side

- `createHUServerClient({ publicBase: "/cdn/" })`
- readable `/v1/games/`
- readable `/v1/games/:id`

### Browser-side

- `/cdn/index.js`
- `globalThis.HU`
- opaque `/cdn/` routes derived from the route-seed cookie

## Legacy public reads removed

Removed from public website2 paths:

- direct browser reads to `/api/theatre/`
- direct browser use of `new TheatreAPI("/api/theatre/")`
- raw `/cdn/thumbnails/:id.webp` links on public game cards
- raw game-id launch URLs on public hub cards and suggestions

## Privileged APIs intentionally unchanged

These remain internal/admin-only:

- `/api/theatre/`
- `/api/theatre/:id/`
- `/api/theatre/:id/plays`
- `/api/theatre/:id/thumbnail`
- import/export and admin CRUD flows

## Route mapping

- `/hub/` popular rows -> `query({ sort: "popular", groupBy: "category", limitPerGroup: 15 })`
- `/hub/all` -> `query()` with paging and sort
- `/hub/[id]` -> `query({ category: [id] })`
- `/hub/apps` -> `query({ category: ["app"] })`
- `/hub/favorites` -> `query({ ids })`
- search suggestions -> `query({ q, limit })`
- launch -> opaque launch token in `/hub/?v=...`

## Current rollout notes

- public pages use `/v1/` on the server and `HU` in the browser
- admin continues to use internal theatre APIs
- build and SDK pack checks pass

## Rollback strategy

Each public route can be rolled back by restoring its previous page/component implementation without touching admin APIs.

Primary rollback points:

- `src/pages/hub/index.astro`
- `src/components/TheatreCategory.astro`
- `src/components/TheatreSearchBar.astro`
- `src/components/TheatrePlayer.astro`
- `src/pages/hub/favorites.astro`

## Verification checklist

- `npm run build`
- `npm pack --dry-run ./sdk`
- public pages do not call `/api/theatre/`
- browser game links do not expose raw game IDs
- public list/detail responses do not expose raw `src` or exact `plays`
