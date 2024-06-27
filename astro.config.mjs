import node from "@astrojs/node";
import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";
import wisp from "wisp-server-node";
import { appConfig } from "./config/config";
import { svga, svgr } from "./svgmin.mjs";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { viteStaticCopy } from "vite-plugin-static-copy";

const require = createRequire(import.meta.url);

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
    plugins: [
      svga(),
      svgr(),
      {
        name: "vite-wisp-server",
        configureServer(server) {
          server.httpServer?.on("upgrade", (req, socket, head) =>
            req.url?.startsWith("/wisp")
              ? wisp.routeRequest(req, socket, head)
              : undefined
          );
        },
      },
      viteStaticCopy({
        targets: [
          {
            src: uvPath,
            dest: "",
            rename: "uv",
            overwrite: false,
          },
          {
            src: baremuxPath,
            dest: "",
            rename: "baremux",
            overwrite: false,
          },
          {
            src: epoxyPath,
            dest: "",
            rename: "epoxy",
            overwrite: false,
          },
          {
            src: resolve(require.resolve("@ruffle-rs/ruffle"), ".."),
            dest: "",
            rename: "ruffle",
          },
        ],
      }),
    ],
  },
  server: {
    host: appConfig.host,
    port: appConfig.port,
  },
  integrations: [preact()],
});
