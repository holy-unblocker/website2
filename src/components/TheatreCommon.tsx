import type { CategoryData, TheatreEntryMin } from "@lib/TheatreAPI";
import styles from "@styles/TheatreCategory.module.scss";
import { useState } from "preact/hooks";

function LoadingItem({ id, name }: { id: string; name: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <a
      className={styles.item}
      href={`/theatre/play?id=${id}`}
      title={name}
      data-load={loaded || undefined}
    >
      <div className={styles.thumbnail}>
        <img
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          src={`/cdn/thumbnails/${id}.webp`}
        />
      </div>
      <div className={styles.name}>{name}</div>
    </a>
  );
}

export function UnknownItem() {
  return (
    <div className={`${styles.item} ${styles.unknown}`}>
      <div className={styles.thumbnail} />
      <div className={styles.name} />
    </div>
  );
}

export interface LoadingTheatreEntry {
  id: string;
  loading: true;
  category: string[];
}

export interface LoadingCategoryData {
  total: number;
  entries: (TheatreEntryMin | LoadingTheatreEntry)[];
  loading: true;
}

export function isLoading(
  data: CategoryData | LoadingCategoryData
): data is LoadingCategoryData;

export function isLoading(
  data: TheatreEntryMin | LoadingTheatreEntry
): data is LoadingTheatreEntry;

export function isLoading(
  data:
    | TheatreEntryMin
    | LoadingTheatreEntry
    | CategoryData
    | LoadingCategoryData
): data is LoadingTheatreEntry | LoadingCategoryData {
  return "loading" in data && data.loading === true;
}

export function ItemList({
  items,
  className,
}: {
  items: (TheatreEntryMin | LoadingTheatreEntry)[];
  className?: string;
}) {
  const children = [];

  for (const item of items) {
    if (isLoading(item)) {
      children.push(<UnknownItem key={item.id} />);
    } else {
      children.push(
        <LoadingItem key={item.id} id={item.id} name={item.name} />
      );
    }
  }

  return <div className={className}>{children}</div>;
}
