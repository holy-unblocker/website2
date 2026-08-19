import styles from "@styles/TheatreCategory.module.scss";
import type { ListOptions, TheatreEntryMin } from "@lib/TheatreAPI";
import type { HUClient } from "@lib/hu";

export const maxResultsPerPage = 30;

type TheatreListClient = Pick<HUClient, "query">;

export function renderTheatreItem(item?: TheatreEntryMin) {
  const container = document.createElement(item === undefined ? "div" : "a");
  container.className =
    styles.item + (item === undefined ? " " + styles.unknown : "");

  const thumb = document.createElement("div");
  thumb.className = styles.thumbnail;
  container.append(thumb);
  thumb.setAttribute("data-load", "");

  if (item !== undefined) {
    (container as HTMLAnchorElement).href = item.launchPath ?? "/hub/";
    container.setAttribute("data-astro-prefetch", "false");
    const img = document.createElement("img");
    img.addEventListener("load", () => thumb.removeAttribute("data-load"));
    if (typeof item.imagePath !== "string") {
      throw new TypeError("Missing image path for theatre item");
    }
    img.src = item.imagePath;
    thumb.append(img);
  }

  const name = document.createElement("div");
  name.className = styles.name;
  if (item !== undefined) name.textContent = item.name;
  container.append(name);

  return container;
}

export async function fetchListData(
  api: TheatreListClient,
  search: string | undefined | null,
  category: string[] | undefined | null,
  sort: string | undefined | null,
  page: number,
) {
  let apiSort: string | undefined;
  let apiOrder: string | undefined;

  switch (sort) {
    case "leastPopular":
      apiSort = "plays";
      apiOrder = "asc";
      break;
    case "mostPopular":
      apiSort = "plays";
      break;
    case "recentlyAddedDESC":
      apiSort = "index";
      break;
    case "recentlyAddedASC":
      apiSort = "index";
      apiOrder = "asc";
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

  const params: ListOptions = {
    category,
    sort: apiSort,
    order: apiOrder,
    offset: page * maxResultsPerPage,
    limit: maxResultsPerPage,
    search,
  };

  return await api.query(params);
}
