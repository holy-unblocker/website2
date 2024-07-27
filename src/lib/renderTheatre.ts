import styles from "@styles/TheatreCategory.module.scss";
import TheatreAPI, { type TheatreEntryMin } from "@lib/TheatreAPI";
import type TheatreWrapper from "@lib/TheatreWrapper";

// this script is shared by the server to do SSR fetching
// and on the client for rendering items

export const maxResultsPerPage = 30;

export const getClientTheatreAPI = () => new TheatreAPI("/api/theatre/");

export function renderTheatreItem(item?: TheatreEntryMin) {
  const container = document.createElement(item === undefined ? "div" : "a");
  container.className =
    styles.item + (item === undefined ? " " + styles.unknown : "");

  const thumb = document.createElement("div");
  thumb.className = styles.thumbnail;
  container.append(thumb);
  thumb.setAttribute("data-load", "");

  if (item !== undefined) {
    (container as HTMLAnchorElement).href = "/hub/?v=" + item.id;
    container.setAttribute("data-astro-prefetch", "false");
    const img = document.createElement("img");
    img.addEventListener("load", () => thumb.removeAttribute("data-load"));
    img.src = `/cdn/thumbnails/${item.id}.webp`;
    thumb.append(img);
  }

  const name = document.createElement("div");
  name.className = styles.name;
  if (item !== undefined) name.textContent = item.name;
  container.append(name);

  return container;
}

export async function fetchListData(
  api: TheatreAPI | TheatreWrapper,
  search: string | undefined | null,
  category: string[] | undefined | null,
  sort: string | undefined | null,
  page: number
) {
  let apiSort: string | undefined;
  let apiOrder: string | undefined;

  switch (sort) {
    case "leastPopular":
      apiOrder = "asc";
      break;
    case "mostPopular":
      apiSort = "plays";
      break;
    case "nameASC":
      apiSort = "name";
      apiOrder = "asc";
      break;
    case "nameDESC":
      apiSort = "name";
      apiOrder = "desc";
      break;
  }

  return await api.list({
    category,
    sort: apiSort,
    order: apiOrder,
    offset: page * maxResultsPerPage,
    limit: maxResultsPerPage,
    search,
  });
}
