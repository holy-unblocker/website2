import DatabaseAPI from "@lib/DatabaseAPI";
import { appConfig } from "@config/config";
import styles from "@styles/TheatreCategory.module.scss";
import clsx from "clsx";
import { useState } from "preact/hooks";

/**
 * one of the above types or a letter/key such as A,B,TAB,SPACE,SHIFT
 */
export type KeyLike =
  | "mouseleft"
  | "mouseright"
  | "scrollup"
  | "scrolldown"
  | "wasd"
  | "arrows"
  | string;

export interface Control {
  keys: KeyLike[];
  label: string;
}

export interface TheatreEntry {
  type:
    | "emulator.nes"
    | "emulator.gba"
    | "emulator.n64"
    | "emulator.genesis"
    | "flash"
    | "embed"
    | "proxy"
    | string;
  controls: Control[];
  category: string[];
  id: string;
  name: string;
  plays: number;
  src: string;
}

export interface LoadingTheatreEntry {
  id: string;
  loading: true;
  category: string[];
}

export interface CategoryData {
  total: number;
  entries: TheatreEntry[];
}

export interface LoadingCategoryData {
  total: number;
  entries: (TheatreEntry | LoadingTheatreEntry)[];
  loading: true;
}

export interface TheatreEntry {
  type:
    | "emulator.nes"
    | "emulator.gba"
    | "emulator.n64"
    | "emulator.genesis"
    | "flash"
    | "embed"
    | "proxy"
    | string;
  controls: Control[];
  category: string[];
  id: string;
  name: string;
  plays: number;
  src: string;
}
export function isLoading(
  data: CategoryData | LoadingCategoryData
): data is LoadingCategoryData;

export function isLoading(
  data: TheatreEntry | LoadingTheatreEntry
): data is LoadingTheatreEntry;

export function isLoading(
  data: TheatreEntry | LoadingTheatreEntry | CategoryData | LoadingCategoryData
): data is LoadingTheatreEntry | LoadingCategoryData {
  return "loading" in data && data.loading === true;
}

export class TheatreAPI extends DatabaseAPI {
  async show(id: String) {
    return await this.fetch<TheatreEntry>(`./theatre/${id}/`);
  }
  async plays(id: string) {
    return await this.fetch<TheatreEntry>(`./theatre/${id}/plays`, {
      method: "PUT",
    });
  }
  async category(params: {
    leastGreatest?: boolean;
    sort?: string;
    category?: string;
    search?: string;
    offset?: number;
    limit?: number;
    limitPerCategory?: number;
  }) {
    return await this.fetch<CategoryData>(
      "./theatre/?" + new URLSearchParams(this.sortParams(params))
    );
  }
}

export function Item({ id, name }: { id: string; name: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <a className={styles.item} href={`/theatre/player/${id}`} title={name}>
      <div className={styles.thumbnail} data-loaded={Number(loaded)}>
        <img
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          src={`/cdn/thumbnails/${id}.webp`}
        ></img>
      </div>
      <div className={styles.name}>{name}</div>
    </a>
  );
}

export function LoadingItem() {
  return (
    <div className={clsx(styles.item, styles.loading)}>
      <div className={styles.thumbnail} />
      <div className={styles.name} />
    </div>
  );
}

export function ItemList({
  items,
  className,
}: {
  items: (TheatreEntry | LoadingTheatreEntry)[];
  className?: string;
}) {
  const children = [];

  for (const item of items) {
    if (isLoading(item)) {
      children.push(<LoadingItem key={item.id} />);
    } else {
      children.push(<Item key={item.id} id={item.id} name={item.name} />);
    }
  }

  return <div className={className}>{children}</div>;
}
