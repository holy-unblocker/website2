import { parse } from "node-html-parser";

export interface AppCloak {
  icon: string;
  title: string;
  url: string;
}

export async function extractCloakData(address: string): Promise<AppCloak> {
  if (address === "about:blank")
    return {
      title: "about:blank",
      icon: "",
      url: "about:blank",
    };

  const res = await fetch(address);

  if (!res.ok) throw new Error(`Cloak address gave status code ${res.status}`);

  const root = parse(await res.text());

  const url = new URL(res.url);

  // try to find the title
  const t = root.querySelector("title");
  const title = t ? t.textContent : `${url.host}${url.pathname}${url.search}`;

  // try to find a shortcut icon
  const iconSelector = root.querySelector("link[rel*='icon']");
  const href = iconSelector?.getAttribute("href");

  // fallback to /favicon.ico
  const icon =
    typeof href === "string"
      ? new URL(href, url).toString()
      : url.origin + "/favicon.ico";

  return { icon, title, url: res.url };
}
