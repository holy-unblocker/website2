import { BareMuxConnection } from "@mercuryworkshop/bare-mux";

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
    console.warn(
      "crossOriginIsolated should be enabled to increase performance."
    );

  if (!navigator.serviceWorker) {
    if (location.protocol === "https:") {
      alert("Please disable incognito mode!");
      throw new Error("Incognito was enabled.");
    } else throw new Error("Your browser doesn't support service workers.");
  }

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    await navigator.serviceWorker.ready;
    console.log("Service worker registered");
  } else {
    await navigator.serviceWorker.register("/sw.js");
    console.log("Service worker registered");
    // console.log("Reloading the page to activate it.");
    // setTimeout(() => location.reload(), 100);
    // return;
  }
}

export async function setupBareMux() {
  if (!("SharedWorker" in window))
    throw new Error(
      "Your browser doesn't support the 'SharedWorker' API. Ultraviolet currently doesn't work on mobile. Sorry!"
    );

  const connection = new BareMuxConnection("/baremux/worker.js");

  const ele = document.getElementById("configThing")!;
  const transport = ele.getAttribute("data-transport")!;
  console.log("Transport:", transport);

  if (transport === "epoxy") {
    const wispUrl = getWispUrl();
    console.log("Using wisp at", wispUrl);
    await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    console.log("Transport set!");
  } else {
    const bareUrl = getBareUrl();
    console.log("Using bare at", bareUrl);
    await connection.setTransport("/baremod/index.mjs", [bareUrl]);
    console.log("Transport set!");
  }
}

// get the Holy Unblocker bare endpoint
export function getBareUrl() {
  // HTML element inserted by astro
  // - it contains the [data-bare-server] attribute which tells the client what wisp server to use
  // - this value is directly from appConfig.
  const ele = document.getElementById("configThing")!;
  const separateBareServer = ele.getAttribute("data-bare")!;

  // defaults to wisp on /api/wisp which is hosted by the Holy Unblocker runtime
  // see: ./config/runtime.js
  // and see separateWispServer in ./config/config.js
  const bareAPI = formatURL(separateBareServer);
  return bareAPI;
}

// get the Holy Unblocker wisp endpoint
export function getWispUrl() {
  // HTML element inserted by astro
  // - it contains the [data-wisp-server] attribute which tells the client what wisp server to use
  // - this value is directly from appConfig.
  const ele = document.getElementById("configThing")!;
  const separateWispServer = ele.getAttribute("data-wisp")!;

  // defaults to wisp on /api/wisp which is hosted by the Holy Unblocker runtime
  // see: ./config/runtime.js
  // and see separateWispServer in ./config/config.js
  const wispAPI = formatURL(separateWispServer);
  return wispAPI;
}

// Replaces %{} crap with their actual values
// eg env: %{ws}%{host}/api/wisp
function formatURL(env: string): string {
  const { host, hostname, protocol } = globalThis.location;
  const vars: Record<string, string> = {
    host,
    hostname,
    protocol,
    ws: protocol === "https:" ? "wss:" : "ws:",
  };
  for (const key in vars) env = env.replaceAll("%{" + key + "}", vars[key]);
  // console.log(env);
  return env;
}
