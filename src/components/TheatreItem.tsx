import styles from "@styles/TheatreCategory.module.scss";
import { useState } from "preact/hooks";

export default function TheatreItem({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <a
      className={styles.item}
      href={`/theatre/play?id=${id}`}
      title={name}
      data-load={!loaded || undefined}
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
