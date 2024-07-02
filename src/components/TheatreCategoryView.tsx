import themeStyles from "@styles/ThemeElements.module.scss";
import TheatreItem from "@components/TheatreItem";
import TheatreAPI, { type CategoryData } from "@lib/TheatreAPI";
import styles from "@styles/TheatreCategory.module.scss";
import ChevronLeft from "@icons/chevron_left_24dp.svg?react";
import ChevronRight from "@icons/chevron_right_24dp.svg?react";
import { useEffect, useState } from "preact/hooks";
import type TheatreWrapper from "@lib/TheatreWrapper";

const LIMIT = 30;

export async function fetchData(
  api: TheatreAPI | TheatreWrapper,
  category: string,
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
    offset: page * LIMIT,
    limit: LIMIT,
  });
}

const TheatreCategoryView = ({
  category,
  initData,
  initSort,
  initPage,
}: {
  category: string;
  initData: CategoryData;
  initSort: string;
  initPage: number;
}) => {
  const [data, setData] = useState<CategoryData | undefined>(initData);
  const [page, setPage] = useState(initPage);
  const [sort, setSort] = useState(initSort);
  const [error, setError] = useState<string | null>(null);
  const maxPage = data === undefined ? -1 : Math.floor(data.total / LIMIT);

  useEffect(() => {
    if (data === undefined)
      fetchData(new TheatreAPI("/api/theatre/"), category, sort, page)
        .then((data) => setData(data))
        .catch((err) => {
          console.error(err);
          setError((err as Error).message);
        });
  }, [data, category, sort, page]);

  useEffect(() => {
    const sort = document.querySelector<HTMLInputElement>("#sort")!;

    const listener = () => {
      const newParams = new URLSearchParams(location.search);
      newParams.delete("page");
      newParams.set("sort", sort.value);
      const st = newParams.toString();
      history.pushState(
        {},
        "",
        st === "" ? location.pathname : `${location.pathname}?${st}`
      );
      setData(undefined);
      setSort(sort.value);
    };
    sort.addEventListener("change", listener);

    return () => sort.removeEventListener("change", listener);
  }, []);

  if (error)
    return (
      <main>
        <p>Unable to fetch category data</p>
        <pre>{error}</pre>
        <div
          onClick={() => location.reload()}
          className={themeStyles.themeLink}
          id="reload"
        >
          Try again by clicking here.
        </div>
      </main>
    );

  return (
    <>
      <div className={styles.items}>
        {data === undefined
          ? [...Array(LIMIT)].map((_, i) => (
              <div key={i} className={`${styles.item} ${styles.unknown}`}>
                <div className={styles.thumbnail} />
                <div className={styles.name} />
              </div>
            ))
          : data.entries.map((e) => <TheatreItem id={e.id} name={e.name} />)}
      </div>
      <div className={styles.pages} data-useless={maxPage === 0 || undefined}>
        <div
          className={styles.button}
          data-disabled={data === undefined || page === 0 || undefined}
          onClick={() => {
            if (data !== undefined && page !== 0) {
              const newParams = new URLSearchParams(location.search);
              if (page === 1)
                newParams.delete("page"); // because page 0 will be blank
              else newParams.set("page", page.toString());
              const st = newParams.toString();
              history.pushState(
                {},
                "",
                st === "" ? location.pathname : `${location.pathname}?${st}`
              );
              setData(undefined);
              setPage(page - 1);
            }
          }}
          dangerouslySetInnerHTML={{ __html: ChevronLeft }}
        />
        <div
          className={styles.button}
          data-disabled={data === undefined || page >= maxPage || undefined}
          onClick={() => {
            if (data !== undefined && page < maxPage) {
              const newParams = new URLSearchParams(location.search);
              newParams.delete("page");
              newParams.set("page", (page + 1 + 1).toString());
              const st = newParams.toString();
              history.pushState(
                {},
                "",
                st === "" ? location.pathname : `${location.pathname}?${st}`
              );
              setData(undefined);
              setPage(page + 1);
            }
          }}
          dangerouslySetInnerHTML={{ __html: ChevronRight }}
        />
      </div>
    </>
  );
};

export default TheatreCategoryView;
