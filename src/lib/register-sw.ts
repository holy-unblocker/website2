/// <reference types="@mercuryworkshop/scramjet-controller" />
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";

// will register /sw.js and setup bare mux
// reloads the page to activate the sw.js if it wasn't registered
export async function setupServiceWorker() {
  // add your network hostname here or whatever
  // this is any page that does NOT have http: but can register a serviceworker
  const isDev = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  if (location.protocol !== "https:" && !isDev)
    throw new Error("HTTPS must be enabled to use Ultraviolet.");

  // this provides a HUGE performance improvement
  if (!window.crossOriginIsolated && !isDev)
    console.warn(
      "crossOriginIsolated should be enabled to increase performance.",
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
      "Your browser doesn't support the 'SharedWorker' API. Ultraviolet currently doesn't work on mobile. Sorry!",
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

export function getProxyEngine(): string {
  const path = location.pathname.replace(/\/+$/, "");
  if (path === "/uv") return "uv";
  if (path === "/scramjet") return "scramjet";

  const pageEngine = document
    .getElementById("omnibox")
    ?.getAttribute("data-proxy-engine");
  if (pageEngine) return pageEngine;

  return document.getElementById("configThing")!.getAttribute("data-engine")!;
}

async function createScramjetTransport() {
  const ele = document.getElementById("configThing")!;
  const transport = ele.getAttribute("data-transport")!;
  const wispUrl = getWispUrl();

  const dynamicImport = (specifier: string): Promise<any> =>
    import(/* @vite-ignore */ specifier);

  if (transport === "epoxy") {
    const { default: EpoxyClient } = await dynamicImport("/epoxy/index.mjs");
    console.log("Scramjet using epoxy wisp at", wispUrl);
    const client = new EpoxyClient({ wisp: wispUrl });
    await client.init();
    return wrapTransport(client);
  }

  const { default: LibcurlClient } = await dynamicImport("/libcurl/index.mjs");
  console.log("Scramjet using libcurl wisp at", wispUrl);
  const client = new LibcurlClient({ wisp: wispUrl });
  await client.init();
  return wrapTransport(client);
}

// Normalize a transport's response headers into an entries array.
// @mercuryworkshop/proxy-transports@1.0.2 stores BareResponse.rawHeaders as the
// raw object returned by transport.request(), but Scramjet 2.x iterates
// rawHeaders as [key, value] pairs (`for (const [k, v] of rawHeaders)`),
// throwing "TypeError: i is not iterable" on a plain object. Converting
// request()'s headers to entries makes them iterable while still constructing a
// valid Headers (which also accepts entries).
function headersToEntries(headers: any): [string, string][] {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers as [string, string][];
  if (typeof headers.entries === "function")
    return [...(headers.entries() as Iterable<[string, string]>)];
  const out: [string, string][] = [];
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (Array.isArray(value)) for (const v of value) out.push([key, v]);
    else out.push([key, value as string]);
  }
  return out;
}

// Wrap a ProxyTransport so request() returns header entries (see above).
function wrapTransport<T extends { request: (...args: any[]) => any }>(
  client: T,
): T {
  const originalRequest = client.request.bind(client);
  client.request = async (...args: any[]) => {
    const res = await originalRequest(...args);
    if (res && typeof res === "object" && "headers" in res)
      res.headers = headersToEntries(res.headers);
    return res;
  };
  return client;
}

let scramjetReady: Promise<void> | undefined;
let scramjetController:
  | InstanceType<typeof $scramjetController.Controller>
  | undefined;
const scramjetFrames = new WeakMap<
  HTMLIFrameElement,
  InstanceType<typeof $scramjetController.Frame>
>();

export function setupScramjet(): Promise<void> {
  if (scramjetReady) return scramjetReady;

  scramjetReady = (async () => {
    const { Controller, config } = $scramjetController;

    config.prefix = "/scram/service/";
    config.scramjetPath = "/scram/scramjet.js";
    config.wasmPath = "/scram/scramjet.wasm";
    config.injectPath = "/scramjet/controller.inject.js";

    const [registration, transport] = await Promise.all([
      navigator.serviceWorker.ready,
      createScramjetTransport(),
    ]);

    const controller = new Controller({
      serviceworker: registration.active!,
      transport,
    });
    await controller.wait();
    scramjetController = controller;

    window.$scramjet = { controller };

    console.log("Scramjet controller initialized at", controller.prefix);
  })();

  return scramjetReady;
}

export async function scramjetGo(
  iframe: HTMLIFrameElement,
  url: string,
): Promise<void> {
  await setupScramjet();
  if (!scramjetController) throw new Error("Scramjet controller is not ready.");

  let frame = scramjetFrames.get(iframe);
  if (!frame) {
    frame = scramjetController.createFrame(iframe);
    scramjetFrames.set(iframe, frame);
  }
  frame.go(url);
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
