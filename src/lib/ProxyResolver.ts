import { encryptURL } from "./cryptURL";

export function resolveProxy(src: string, setting: string) {
  let route;

  switch (setting) {
    default:
    case "ultraviolet":
      route = "/compat/ultraviolet";
      break;
  }

  return `${route}#${encryptURL(src)}`;
}
