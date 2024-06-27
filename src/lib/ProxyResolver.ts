import CompatAPI from "@lib/CompatAPI";
import { encryptURL } from "./cryptURL";
import { isError } from "./isAbortError";

export type FixedProxy = "ultraviolet" | "rammerhead";

export function resolveProxyFixed(src: string, setting: FixedProxy) {
  let route;

  switch (setting) {
    default:
    case "ultraviolet":
      route = "/compat/ultraviolet";
      break;
  }

  return `${route}#${encryptURL(src)}`;
}

export default async function resolveProxy(
  src: string,
  setting: string,
  signal?: AbortSignal
) {
  if (setting === "automatic") {
    const { host } = new URL(src);
    const api = new CompatAPI(window.db_api, signal);

    try {
      setting = (await api.compat(host)).proxy;
    } catch (err) {
      if (isError(err) && err.message === "Not Found") {
        setting = "ultraviolet"; // DEFAULT PROXY
      } else {
        console.error(err);
        throw err;
      }
    }
  }

  return resolveProxyFixed(src, setting as FixedProxy);
}
