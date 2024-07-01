importScripts("/epoxy/index.js");
importScripts("uv.bundle.js");
importScripts("uv.config.js");
importScripts(__uv$config.sw || "uv.sw.js");

const uv = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  console.log("SW URL:", event.request.url);
  event.respondWith(uv.fetch(event));
});
