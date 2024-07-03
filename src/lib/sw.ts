import { SetTransport } from "@mercuryworkshop/bare-mux";

// will register /sw.js and setup bare mux
// reloads the page to activate the sw.js if it wasn't registered
export async function setupServiceWorker() {
  // add your network hostname here or whatever
  // this is any page that does NOT have http: but can register a serviceworker
  const isDev = ["localhost", "127.0.0.1"].includes(location.hostname);

  if (location.protocol !== "https:" && !isDev)
    throw new Error("HTTPS must be enabled to use Ultraviolet.");

  // this provides a HUGE performance improvement
  if (!window.crossOriginIsolated && !isDev)
    throw new Error("crossOriginIsolated must be enabled to use Ultraviolet.");

  if (!navigator.serviceWorker)
    throw new Error("Your browser doesn't support service workers.");

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    await navigator.serviceWorker.ready;
    console.log("Service worker registered");
  } else {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("Service worker registered");
    console.log("Reloading the page to activate it.");
    location.reload();
    return;
  }

  console.log("Using wisp at", window.wisp_api);
  SetTransport("EpxMod.EpoxyClient", {
    wisp: getWispEndpoint(),
  });
}

// get the Holy Unblocker wisp endpoint
export function getWispEndpoint() {
  // HTML element inserted by astro
  // - it contains the [data-wisp] attribute which tells the client what wisp server to use
  // - this value is directly from appConfig.
  const separateWispServer = document
    .querySelector("[data-separateWispServer]")
    ?.getAttribute("data-separateWispServer");

  // defaults to wisp on /wisp/, part of Holy Unblocker runtime
  // see: ./config/runtime.js
  const wispAPI = formatURL(
    typeof separateWispServer === "string"
      ? separateWispServer
      : "%{ws}//%{host}/wisp/"
  );

  return wispAPI;
}

// Replaces %{} crap with their actual values
// eg env: %{ws}%{host}/wisp/
function formatURL(env: string): string {
  const { host, hostname, protocol } = globalThis.location;
  const vars: Record<string, string> = {
    host,
    hostname,
    protocol,
    ws: protocol === "https:" ? "wss:" : "ws:",
  };
  for (const key in vars) env = env.replaceAll("%{" + key + "}", vars[key]);
  console.log(env);
  return env;
}
