/* eslint-disable no-undef */
importScripts("../epoxy/index.js");
importScripts("uv.bundle.js");
importScripts("uv.config.js");
importScripts(__uv$config.sw || "uv.sw.js");
const sw = new UVServiceWorker();

globalThis.addEventListener("fetch", (event) => {
  event.respondWith(sw.fetch(event));
});
