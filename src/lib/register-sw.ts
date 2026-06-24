/// <reference types="@mercuryworkshop/scramjet-controller" />
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import type * as ScramjetController from "@mercuryworkshop/scramjet-controller";
import { getURLKeyBase64 } from "./cryptURL";
import { getSiteConfig } from "./siteConfig";

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
  const swParams = new URLSearchParams();
  if (getAdblock()) swParams.set("adblock", "1");
  if (getNoscript()) swParams.set("noscript", "1");
  swParams.set("key", getURLKeyBase64());
  const swQuery = swParams.toString();
  const swUrl = swQuery ? `${swPath}?${swQuery}` : swPath;

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    const activeUrl =
      reg.active?.scriptURL ||
      reg.installing?.scriptURL ||
      reg.waiting?.scriptURL ||
      "";
    const wantAdblock = swUrl.includes("adblock=1");
    const hasAdblock = activeUrl.includes("adblock=1");
    const wantNoscript = swUrl.includes("noscript=1");
    const hasNoscript = activeUrl.includes("noscript=1");
    const wantedKey = new URL(swUrl, location.href).searchParams.get("key");
    const activeKey = activeUrl
      ? new URL(activeUrl).searchParams.get("key")
      : null;
    if (
      wantAdblock !== hasAdblock ||
      wantNoscript !== hasNoscript ||
      wantedKey !== activeKey
    ) {
      await navigator.serviceWorker.register(swUrl, {
        scope: "/",
        updateViaCache: "none",
      });
      console.log("Service worker re-registered (adblock/noscript toggled)");
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

  const transport = getSiteConfig().transport;
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
  if (path === "/sj") return "sj";

  const pageEngine = document
    .getElementById("omnibox")
    ?.getAttribute("data-proxy-engine");
  if (pageEngine) return pageEngine;

  return getSiteConfig().engine;
}

// whether adblock (domain blacklisting) is enabled, from #config
export function getAdblock(): boolean {
  return getSiteConfig().adblock === "1";
}

// whether noscript (stripping scripts from proxied pages) is enabled, from #config
export function getNoscript(): boolean {
  return getSiteConfig().noscript === "1";
}

async function createScramjetTransport() {
  const transport = getSiteConfig().transport;
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
let activeScramjetController: ScramjetController.Controller | undefined;
const scramjetFrames = new WeakMap<
  HTMLIFrameElement,
  ScramjetController.Frame
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
        prefix: routes.sjConfig.prefix,
        scramjetPath: routes.sjConfig.scramjetPath,
        wasmPath: routes.sjConfig.wasmPath,
        injectPath: routes.sjConfig.injectPath,
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
    activeScramjetController = controller;

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
    | "sj"
    | "sjWasm"
    | "sjControllerApi"
    | "sjControllerInject"
    | "sjControllerSw",
    string
  >;
  uvConfig: {
    prefix: string;
    handler: string;
    bundle: string;
    config: string;
    client: string;
    sw: string;
  };
  sjConfig: {
    prefix: string;
    scramjetPath: string;
    wasmPath: string;
    injectPath: string;
  };
};

function getProxyRoutes(): ProxyRoutes {
  const raw = getSiteConfig().routes;
  if (!raw) throw new Error("Missing proxy route metadata.");
  return JSON.parse(raw) as ProxyRoutes;
}

// the randomized /scram/service/ prefix for the current user
export function getScramjetPrefix(): string {
  return getProxyRoutes().sjConfig.prefix;
}

export async function scramjetGo(
  iframe: HTMLIFrameElement,
  url: string,
): Promise<void> {
  await setupScramjet();
  if (!activeScramjetController)
    throw new Error("Scramjet controller is not ready.");

  let frame = scramjetFrames.get(iframe);
  if (!frame) {
    frame = activeScramjetController.createFrame(iframe);
    scramjetFrames.set(iframe, frame);
  }
  frame.go(url);
}

// get the Holy Unblocker bare endpoint
export function getBareUrl() {
  const separateBareServer = getSiteConfig().bare;

  // defaults to wisp on /api/wisp which is hosted by the Holy Unblocker runtime
  // see: ./config/runtime.js
  // and see separateWispServer in ./config/config.js
  const bareAPI = formatURL(separateBareServer);
  return bareAPI;
}

// get the Holy Unblocker wisp endpoint
export function getWispUrl() {
  const separateWispServer = getSiteConfig().wisp;

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
