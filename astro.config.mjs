import path from "node:path";
import node from "@astrojs/node";
import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";
import wisp from "wisp-server-node";
import { svga, svgr } from "./svgmin.mjs";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux";
import { createRequire } from "node:module";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { access, copyFile } from "node:fs/promises";

try {
  await access("./config/config.js");
} catch (err) {
  if (err?.code === "ENOENT") {
    console.log("Holy Unblocker: No config.js file found. Making one.");
    copyFile("./config/config.example.js", "./config/config.js");
    console.log("Holy Unblocker: config.example.js -> config.js");
  } else throw err; // wut
}

// only needed for dev server host & port
const { appConfig } = await import("./config/config.js");
// and mirroring
const { handleReq } = await import("./config/mirrors.js");

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
  experimental: {
    rewriting: true, // used for dev server mirrors
  },
  vite: {
    build: {
      dynamicImportVarsOptions: {
        exclude: [path.resolve("./config/config.js")],
      },
      assetsInlineLimit: 0,
    },
    plugins: [
      svga(),
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
            src: rufflePath,
            dest: "",
            rename: "ruffle",
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
    preact(),
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
            if (req.url.startsWith("/wisp/"))
              wisp.routeRequest(req, socket, head);
            else astroHMR(req, socket, head);
          };
        },
      },
    },
  ],
});
