import CommonError from "@components/CommonError";
import { ItemList, isLoading, type LoadingCategoryData } from "./TheatreCommon";
import TheatreAPI, { type CategoryData } from "@lib/TheatreAPI";
import isAbortError from "@lib/isAbortError";
import styles from "@styles/TheatreCategory.module.scss";
import ChevronLeft from "@icons/chevron_left_24dp.svg?react";
import ChevronRight from "@icons/chevron_right_24dp.svg?react";
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

export const Category = ({ category }: { category: string }) => {
  const [search, setSearch] = useSearchParams();
  let page = parseInt(search.get("page")!);
  if (isNaN(page)) page = 1;
  page -= 1;
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

      const api = new TheatreAPI("/api/theatre/", abort.signal);

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

  useEffect(() => {
    const sort = document.querySelector<HTMLInputElement>("#sort")!;

    const listener = () => {
      setSearch({
        page: null,
        sort: sort.value,
      });
    };
    sort.addEventListener("change", listener);

    return () => sort.removeEventListener("change", listener);
  }, []);

  return (
    <>
      <ItemList className={styles.items} items={foundData.entries} />
      <div className={styles.pages} data-useless={maxPage === 0 || undefined}>
        <div
          className={styles.button}
          data-disabled={page === 0 || undefined}
          onClick={() => {
            if (!isLoading(foundData) && page) {
              let newpage: number | null = Math.max(page - 1, 0) + 1;
              if (newpage === 1) newpage = null;
              setSearch({
                page: newpage,
              });
            }
          }}
          dangerouslySetInnerHTML={{ __html: ChevronLeft }}
        />
        <div
          className={styles.button}
          data-disabled={page >= maxPage || undefined}
          onClick={() => {
            if (!isLoading(foundData) && page < maxPage) {
              setSearch({ page: page + 1 + 1 });
            }
          }}
          dangerouslySetInnerHTML={{ __html: ChevronRight }}
        />
      </div>
    </>
  );
};
