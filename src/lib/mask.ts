import { sillyfetch } from "@lib/sillyfetch";

export interface ExtractedData {
  title: string;
  icon: string;
  url: string;
}

export async function extractData(address: string): Promise<ExtractedData> {
  const url = resolveURL(address);

  if (url === "about:blank")
    return {
      title: "about:blank",
      icon: "none",
      url: "about:blank",
    };

  const response = await sillyfetch(url);

  if (!response) throw new Error(`Response was not OK`);

  const parser = new DOMParser();

  const dom = parser.parseFromString(await response.text(), "text/html");

  const base = document.createElement("base");
  base.href = response.url;

  dom.head.append(base);

  let icon: string;

  const iconSelector = dom.querySelector(
    'link[rel*="icon"]'
  ) as HTMLLinkElement | null;

  if (iconSelector && iconSelector.href !== "") icon = iconSelector.href;
  else icon = new URL("/favicon.ico", url).toString();

  const outgoing = await sillyfetch(icon);

  icon = await blobToDataURL(
    new Blob([await outgoing.arrayBuffer()], {
      type: outgoing.headers.get("content-type")!,
    })
  );

  let title = dom.title;

  if (!title) {
    const url = new URL(response.sillyurl);
    title = `${url.host}${url.pathname}${url.search}`;
  }

  return { icon, title, url: response.sillyurl };
}

const whitespace = /\s+/;
const protocol = /^\w+:/;

function resolveURL(input: string) {
  if (input.match(protocol)) {
    return input;
  } else if (input.includes(".") && !input.match(whitespace)) {
    return `http://${input}`;
  } else {
    throw new Error("Invalid URL.");
  }
}

async function blobToDataURL(blob: Blob) {
  const reader = new FileReader();

  return new Promise<string>((resolve, reject) => {
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(blob);
  });
}
