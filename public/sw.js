importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts(__uv$config.sw || "/uv/uv.sw.js");

const uv = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  // console.log("SW URL:", event.request.url);
  if (event.request.url.startsWith(location.origin + __uv$config.prefix))
    event.respondWith(uv.fetch(event));
});
