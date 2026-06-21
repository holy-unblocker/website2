/// <reference types="@mercuryworkshop/scramjet-controller" />
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";

// registers the randomized service worker and sets up BareMux.
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
  const swPath = getProxyRoutes().paths.serviceWorker;
  const swUrl = getAdblock() ? `${swPath}?adblock=1` : swPath;

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    const activeUrl =
      reg.active?.scriptURL ||
      reg.installing?.scriptURL ||
      reg.waiting?.scriptURL ||
      "";
    const wantAdblock = swUrl.includes("adblock=1");
    const hasAdblock = activeUrl.includes("adblock=1");

    // Check the active registration points at the same seeded script. If the
    // user lost their scope/seed cookie, the seeded path changes, so the
    // existing scriptURL won't match swPath and we must re-register.
    let samePath = false;
    if (activeUrl) {
      try {
        samePath = new URL(activeUrl).pathname === swPath;
      } catch {
        samePath = false;
      }
    }

    if (wantAdblock !== hasAdblock || !samePath) {
      await navigator.serviceWorker.register(swUrl, {
        scope: "/",
        updateViaCache: "none",
      });
      console.log(
        !samePath
          ? "Service worker re-registered (script path changed)"
          : "Service worker re-registered (adblock toggled)",
      );
    } else {
      await reg.update();
    }
    await navigator.serviceWorker.ready;
    console.log("Service worker registered");
  } else {
    await navigator.serviceWorker.register(swUrl, {
      scope: "/",
      updateViaCache: "none",
    });
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

  const routes = getProxyRoutes();
  const connection = new BareMuxConnection(routes.assets.baremuxWorker);

  const ele = document.getElementById("configThing")!;
  const transport = ele.getAttribute("data-transport")!;
  console.log("Transport:", transport);

  if (transport === "epoxy") {
    const wispUrl = getWispUrl();
    console.log("Using wisp at", wispUrl);
    await connection.setTransport(routes.assets.epoxyIndex, [
      { wisp: wispUrl },
    ]);
    console.log("Transport set!");
  } else {
    const bareUrl = getBareUrl();
    console.log("Using bare at", bareUrl);
    await connection.setTransport(routes.assets.baremodIndex, [bareUrl]);
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

// whether adblock (domain blacklisting) is enabled, from #configThing
export function getAdblock(): boolean {
  return (
    document.getElementById("configThing")?.getAttribute("data-adblock") === "1"
  );
}

async function createScramjetTransport() {
  const ele = document.getElementById("configThing")!;
  const transport = ele.getAttribute("data-transport")!;
  const wispUrl = getWispUrl();
  const routes = getProxyRoutes();

  const dynamicImport = (specifier: string): Promise<any> =>
    import(/* @vite-ignore */ specifier);

  const url =
    transport === "epoxy"
      ? routes.assets.epoxyIndex
      : routes.assets.libcurlIndex;

  console.log("Scramjet transport:", transport, "wisp:", wispUrl);
  const { default: TransportClient } = await dynamicImport(url);
  return new TransportClient({ wisp: wispUrl });
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
    const { Controller } = $scramjetController;
    const { defaultConfig } = $scramjet;
    const routes = getProxyRoutes();

    const [registration, transport] = await Promise.all([
      navigator.serviceWorker.ready,
      createScramjetTransport(),
    ]);

    const serviceworker =
      navigator.serviceWorker.controller ?? registration.active!;

    const controller = new Controller({
      serviceworker,
      transport,
      config: {
        prefix: routes.scramjet.prefix,
        scramjetPath: routes.scramjet.scramjetPath,
        wasmPath: routes.scramjet.wasmPath,
        injectPath: routes.scramjet.injectPath,
      },
      scramjetConfig: {
        ...defaultConfig,
        flags: {
          ...defaultConfig.flags,
          allowFailedIntercepts: true,
          allowInvalidJs: true,
        },
      },
    });
    await controller.wait();
    scramjetController = controller;

    console.log("Scramjet controller initialized at", controller.prefix);
  })();

  return scramjetReady;
}

type ProxyRoutes = {
  paths: Record<
    | "serviceWorker"
    | "uvService"
    | "scramService"
    | "registerUV"
    | "registerScramjet",
    string
  >;
  assets: Record<
    | "baremuxIndex"
    | "baremuxWorker"
    | "baremodIndex"
    | "epoxyIndex"
    | "libcurlIndex"
    | "uvBundle"
    | "uvConfig"
    | "uvHandler"
    | "uvClient"
    | "uvSw"
    | "scramjet"
    | "scramjetWasm"
    | "scramjetControllerApi"
    | "scramjetControllerInject"
    | "scramjetControllerSw",
    string
  >;
  scramjet: {
    prefix: string;
    scramjetPath: string;
    wasmPath: string;
    injectPath: string;
  };
};

function getProxyRoutes(): ProxyRoutes {
  const raw = document
    .getElementById("configThing")!
    .getAttribute("data-proxy-routes");
  if (!raw) throw new Error("Missing proxy route metadata.");
  return JSON.parse(raw) as ProxyRoutes;
}

// the randomized /scram/service/ prefix for the current user
export function getScramjetPrefix(): string {
  return getProxyRoutes().scramjet.prefix;
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
