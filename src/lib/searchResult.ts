import styles from "@styles/ProxyOmnibox.module.scss";
import { theatreCategories } from "@lib/gameCategories";

export const renderSearchResult = (
  result: string,
  query: string,
  categories?: string[] | null,
) => {
  const ele = document.createElement("div");

  // search icon
  const search = document.createElement("span");
  search.className = styles.search;
  search.innerHTML = `<svg><use href="#searchGlass"></use></svg>`;
  ele.append(search);

  const text = document.createElement("span");
  text.className = styles.result;
  if (result.trim().toLowerCase().startsWith(query.toLowerCase())) {
    // make the part that matches the query bold
    const b = document.createElement("b");
    b.append(query);
    text.append(b);
    text.append(result.slice(query.length));
  } else {
    text.append(result);
  }
  ele.append(text);

  if (
    typeof categories === "object" &&
    categories !== null &&
    typeof categories[0] === "string"
  ) {
    const e = document.createElement("div");
    e.className = styles.category;
    const category = theatreCategories.find((c) => c.id === categories[0]);
    if (category === undefined)
      throw new Error(`unknown theatre category id: ${categories[0]}`);
    e.textContent = category.name;
    ele.append(e);
  }

  // open icon
  const open = document.createElement("span");
  open.className = styles.open;
  open.innerHTML = `<svg><use href="#northWest"></use></svg>`;
  ele.append(open);

  return ele;
};
