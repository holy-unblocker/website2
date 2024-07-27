import path from "node:path";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { svgr } from "./svgmin.mjs";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createRequire } from "node:module";
import { viteStaticCopy } from "vite-plugin-static-copy";

// LOAD RUNTIME FIRST
// RUNTIME WILL COPY THE EXAMPLE CONFIG IF IT DOESNT EXIST

// we add these hooks to the astro dev server
const { handleReq, handleUpgrade } = await import("./runtime.js");

// only needed for dev server host & port
const { appConfig } = await import("./config/config.js");
const require = createRequire(import.meta.url);
const rufflePath = path.resolve(require.resolve("@ruffle-rs/ruffle"), "..");

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "middleware",
  }),
  // used for dev server
  server: {
    port: appConfig.port,
    host: appConfig.host,
  },
  site: "https://" + appConfig.mainWebsite,
  vite: {
    build: {
      dynamicImportVarsOptions: {
        exclude: [
          path.resolve("./config/config.js"),
          path.resolve("./config/apis.js"),
        ],
      },
      assetsInlineLimit: 0,
    },
    plugins: [
      svgr(),
      viteStaticCopy({
        targets: [
          {
            src: uvPath,
            dest: "",
            rename: "uv",
            overwrite: false,
          },
          {
            src: epoxyPath,
            dest: "",
            rename: "epoxy",
            overwrite: false,
          },
          {
            src: rufflePath,
            dest: "",
            rename: "ruffle",
          },
          {
            src: baremuxPath,
            dest: "",
            rename: "baremux",
          },
        ],
      }),
    ],
  },
  // this will mess with the httpServer hook because it makes a websocket listener
  devToolbar: {
    enabled: false,
  },
  integrations: [
    {
      name: "Holy Unblocker dev server",
      hooks: {
        "astro:server:setup": (opts) => {
          const { httpServer } = opts.server;
          const astroMiddleware = httpServer._events.request;
          httpServer._events.request = (req, res) => {
            // mirrors, /uv/service/ redirect
            handleReq(req, res, () => astroMiddleware(req, res));
          };

          // start a wisp server while letting HMR run
          const astroHMR = httpServer._events.upgrade;
          httpServer._events.upgrade = (req, socket, head) => {
            if (req.url === "/") astroHMR(req, socket, head);
            else handleUpgrade(req, socket, head);
          };
        },
      },
    },
    sitemap({
      changefreq: "daily",
    }),
  ],
});
