import { getGlobalSettings } from "@lib/storage";
import TheatreAPI, { type TheatreEntryMin } from "@lib/TheatreAPI";
import styles from "@styles/TheatreCategory.module.scss";
import { useEffect, useState } from "preact/hooks";
import TheatreItem from "@components/TheatreItem";

const TheatreFavorites = () => {
  const globalSettings = getGlobalSettings();
  const favorites = globalSettings.get("favorites");
  const [data, setData] = useState<(TheatreEntryMin | undefined)[]>(() => [
    ...Array(favorites.length),
  ]);

  useEffect(() => {
    const api = new TheatreAPI("/api/theatre/");

    for (const id of favorites)
      api
        .show(id)
        .then((e) => {
          data[favorites.indexOf(id)] = {
            name: e.name,
            id: e.id,
            category: e.category,
          };
          setData([...data]);
        })
        .catch((err) => {
          console.warn("Unable to fetch entry:", id, err);
          const i = favorites.indexOf(id);
          favorites.splice(i, 1);
          data.splice(i, 1);
          setData([...data]);
          globalSettings.set("favorites", favorites);
        });
  }, []);

  if (favorites.length === 0)
    return <p>Once you favorite some games, they will appear here.</p>;

  return (
    <div class={styles.items}>
      {data.map((e) =>
        e === undefined ? (
          <div className={`${styles.item} ${styles.unknown}`}>
            <div className={styles.thumbnail} />
            <div className={styles.name} />
          </div>
        ) : (
          <TheatreItem key={e.id} id={e.id} name={e.name} />
        )
      )}
    </div>
  );
};

export default TheatreFavorites;
