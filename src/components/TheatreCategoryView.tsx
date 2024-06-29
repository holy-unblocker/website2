import CommonError from "@components/CommonError";
import type { CategoryData, LoadingCategoryData } from "./TheatreCommon";
import { isLoading } from "./TheatreCommon";
import { ItemList, TheatreAPI } from "./TheatreCommon";
import SearchBar from "./TheatreSearchBar";
import { ThemeSelect } from "./ThemeSelect";
// import { appConfig } from "@config/config";
import isAbortError from "@lib/isAbortError";
import styles from "@styles/TheatreCategory.module.scss";
import ChevronLeft from "@icons/chevron_left_24dp.svg?react";
import ChevronRight from "@icons/chevron_right_24dp.svg?react";
import clsx from "clsx";
import { useEffect, useState } from "preact/hooks";
import { useSearchParams } from "@lib/searchParamsHook";

const LIMIT = 30;

function createLoading(total: number) {
  const loading: LoadingCategoryData = {
    total,
    entries: [],
    loading: true,
  };

  for (let i = 0; i < LIMIT; i++) {
    loading.entries.push({
      id: i.toString(),
      loading: true,
      category: [],
    });
  }

  return loading;
}

export const Category = ({
  name,
  category,
  placeholder,
  showCategory,
}: {
  name: string;
  category: string;
  placeholder?: string;
  showCategory?: boolean;
}) => {
  const [search, setSearch] = useSearchParams();
  let page = parseInt(search.get("page")!);
  if (isNaN(page)) page = 0;
  const [lastTotal, setLastTotal] = useState(LIMIT * 2);
  const [data, setData] = useState<CategoryData | null>(null);
  const foundData = data || createLoading(lastTotal);
  const maxPage = Math.floor(foundData.total / LIMIT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);

    const abort = new AbortController();

    (async function () {
      let leastGreatest = false;
      let sort;

      switch (search.get("sort")) {
        case "leastPopular":
          leastGreatest = true;
        // fallthrough
        case "mostPopular":
          sort = "plays";
          break;
        case "nameASC":
          leastGreatest = true;
        // fallthrough
        case "nameDES":
          sort = "name";
          break;
      }

      const api = new TheatreAPI(window.db_api, abort.signal);

      try {
        const data = await api.category({
          category,
          sort,
          leastGreatest,
          offset: page * LIMIT,
          limit: LIMIT,
        });

        setData(data);
        setLastTotal(data.total);
      } catch (err) {
        if (!isAbortError(err)) {
          console.error(err);
          setError(String(err));
        }
      }
    })();

    return () => abort.abort();
  }, [category, search.get("sort"), page]);

  if (error)
    return (
      <CommonError
        cause="Unable to fetch the category data."
        error={error}
        message="An error occurred while loading the category"
      />
    );

  return (
    <main className={styles.main}>
      <SearchBar
        showCategory={showCategory}
        category={category}
        placeholder={placeholder}
      />
      <section>
        <div className={styles.name}>
          <h1>{name}</h1>
          <ThemeSelect
            options={[
              { name: "Most Popular", value: "mostPopular" },
              { name: "Least Popular", value: "leastPopular" },
              { name: "Name (A-Z)", value: "nameASC" },
              { name: "Name (Z-A)", value: "nameDES" },
            ]}
            className={styles.sort}
            defaultValue={search.get("sort")!}
            onChange={(event) => {
              setSearch({
                page: null,
                sort: event.target.value,
              });
            }}
          />
        </div>
        <ItemList className={styles.items} items={foundData.entries} />
      </section>
      <div className={clsx(styles.pages, maxPage === 0 && styles.useless)}>
        <div
          className={clsx(styles.button, !page && styles.disabled)}
          onClick={() => {
            if (!isLoading(foundData) && page) {
              setSearch({
                page: Math.max(page - 1, 0),
              });
            }
          }}
          dangerouslySetInnerHTML={{ __html: ChevronLeft }}
        />
        <div
          className={clsx(styles.button, page >= maxPage && styles.disabled)}
          onClick={() => {
            if (!isLoading(foundData) && page < maxPage) {
              setSearch({ page: page + 1 });
            }
          }}
          dangerouslySetInnerHTML={{ __html: ChevronRight }}
        />
      </div>
    </main>
  );
};
