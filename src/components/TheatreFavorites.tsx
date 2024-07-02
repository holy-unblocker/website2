import { getGlobalSettings } from "@lib/storage";
import TheatreAPI, { type TheatreEntryMin } from "@lib/TheatreAPI";
import styles from "@styles/TheatreCategory.module.scss";
import { useEffect, useState } from "preact/hooks";
import TheatreItem from "@components/TheatreItem";

const TheatreFavorites = () => {
  const globalSettings = getGlobalSettings();
  const favorites = globalSettings.get("favorites");
  const [data, setData] = useState<TheatreEntryMin[] | undefined>(undefined);

  useEffect(() => {
    const api = new TheatreAPI("/api/theatre/");

    api
      .list({
        ids: favorites,
      })
      .then((data) => {
        for (const id of favorites) {
          if (!data.entries.some((e) => e.id === id)) {
            console.log(
              "could not find entry id",
              id,
              "in result, assuming it was deleted"
            );
            favorites.splice(favorites.indexOf(id), 1);
          }
        }

        setData(data.entries);
        globalSettings.set("favorites", favorites);
      });
  }, []);

  if (favorites.length === 0)
    return <p>Once you favorite some games, they will appear here.</p>;

  return (
    <div class={styles.items}>
      {data === undefined
        ? [...Array(favorites.length)].map((_, i) => (
            <div key={i} className={`${styles.item} ${styles.unknown}`}>
              <div className={styles.thumbnail} />
              <div className={styles.name} />
            </div>
          ))
        : data.map((item) => (
            <TheatreItem key={item.id} id={item.id} name={item.name} />
          ))}
    </div>
  );
};

export default TheatreFavorites;
