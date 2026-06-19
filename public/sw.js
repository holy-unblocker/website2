importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts(__uv$config.sw || "/uv/uv.sw.js");
importScripts("/scramjet/controller.sw.js");

let uv;
function getUV() {
  if (!uv) uv = new UVServiceWorker();
  return uv;
}

self.addEventListener("fetch", (event) => {
  if (
    typeof $scramjetController !== "undefined" &&
    $scramjetController.shouldRoute(event)
  ) {
    event.respondWith($scramjetController.route(event));
    return;
  }

  // console.log("SW URL:", event.request.url);
  if (event.request.url.startsWith(location.origin + __uv$config.prefix))
    event.respondWith(getUV().fetch(event));
});
