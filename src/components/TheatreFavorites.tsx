import { useGlobalSettings } from "@lib/storage";
import TheatreAPI, { type TheatreEntry } from "@lib/TheatreAPI";
import { type LoadingTheatreEntry, ItemList } from "@components/TheatreCommon";
import { isFailedToFetch } from "@lib/isAbortError";
import styles from "@styles/TheatreCategory.module.scss";
import { useEffect, useState } from "preact/hooks";

const TheatreFavorites = () => {
  const [settings, setSettings] = useGlobalSettings();

  const [data, setData] = useState<(TheatreEntry | LoadingTheatreEntry)[]>(() =>
    settings.favorites.map((id) => ({
      loading: true,
      id,
      category: [],
    }))
  );

  useEffect(() => {
    const abort = new AbortController();

    (async function () {
      const api = new TheatreAPI("/api/theatre/", abort.signal);
      const data = [];

      for (const id of settings.favorites) {
        try {
          data.push(await api.show(id));
        } catch (err) {
          // cancelled? page unload?
          if (!isFailedToFetch(err)) {
            console.warn("Unable to fetch entry:", id, err);
            settings.favorites.splice(settings.favorites.indexOf(id), 1);
          }
        }
      }

      // update settings
      setSettings({
        ...settings,
      });

      setData(data);
    })();

    return () => abort.abort();
  }, [setSettings, settings]);

  if (settings.favorites.length === 0)
    return <p>You haven't favorited any games yet.</p>;

  return (
    <div class={styles.items}>
      <ItemList items={data} />
    </div>
  );
};

export default TheatreFavorites;
