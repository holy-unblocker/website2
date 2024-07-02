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
    (container as HTMLAnchorElement).href = "/theatre/play?id=" + item.id;

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

export async function fetchCategoryData(
  api: TheatreAPI | TheatreWrapper,
  category: string[],
  sort: string,
  page: number
) {
  let leastGreatest = false;
  let sortBy;

  switch (sort) {
    case "leastPopular":
      leastGreatest = true;
    // fallthrough
    case "mostPopular":
      sortBy = "plays";
      break;
    case "nameASC":
      leastGreatest = true;
    // fallthrough
    case "nameDES":
      sortBy = "name";
      break;
  }

  // const api = new TheatreAPI("/api/theatre/");

  return await api.list({
    category,
    sort: sortBy,
    leastGreatest,
    offset: page * maxResultsPerPage,
    limit: maxResultsPerPage,
  });
}
