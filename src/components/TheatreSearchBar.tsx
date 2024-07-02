import TheatreAPI, { type CategoryData } from "@lib/TheatreAPI";
import themeStyles from "@styles/ThemeElements.module.scss";
import categories from "@lib/gameCategories";
import isAbortError from "@lib/isAbortError";
import styles from "@styles/TheatreSearch.module.scss";
import Search from "@icons/search_24dp.svg?react";
import { useRef, useState } from "preact/hooks";

const LIMIT = 8;

const SearchBar = ({
  category,
  placeholder,
  showCategory,
}: {
  category: string;
  placeholder?: string;
  showCategory?: boolean;
}) => {
  const input = useRef<HTMLInputElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData>({
    total: 0,
    entries: [],
  });
  const [lastSelect, setLastSelect] = useState(-1);
  const [inputFocused, setInputFocused] = useState(false);
  const searchAbort = useRef(new AbortController());
  const lastQuery = useRef<string | null>(null);

  async function search(query: string) {
    if (lastQuery.current === query) return;
    lastQuery.current = query;
    searchAbort.current.abort();
    searchAbort.current = new AbortController();

    const api = new TheatreAPI("/api/theatre/", searchAbort.current.signal);

    try {
      const categoryData = await api.category({
        sort: "search",
        search: query,
        limit: LIMIT,
        category,
      });

      setCategoryData(categoryData);
    } catch (err) {
      if (!isAbortError(err)) {
        console.error(err);
      }
    }
  }

  const renderSuggested = inputFocused && categoryData.entries.length !== 0;

  return (
    <div
      className={styles.search}
      data-focused={inputFocused || undefined}
      data-suggested={renderSuggested || undefined}
      ref={bar}
    >
      <div className={`${themeStyles.ThemeInputBar} ${styles.inputBar}`}>
        <div
          className={themeStyles.icon}
          dangerouslySetInnerHTML={{ __html: Search }}
        />
        <input
          ref={input}
          type="text"
          className={themeStyles.thinPadLeft}
          placeholder={placeholder}
          onFocus={() => {
            setInputFocused(true);
            setLastSelect(-1);
            search(input.current!.value);
          }}
          onBlur={(event) => {
            if (!bar.current!.contains(event.relatedTarget as Node)) {
              setInputFocused(false);
            }
          }}
          onClick={() => {
            setInputFocused(true);
            setLastSelect(-1);
            search(input.current!.value);
          }}
          onKeyDown={(event) => {
            let preventDefault = true;

            switch (event.code) {
              case "Escape":
                setInputFocused(false);
                break;
              case "ArrowDown":
              case "ArrowUp":
                {
                  const lastI = lastSelect;

                  let next;

                  switch (event.code) {
                    case "ArrowDown":
                      if (lastI >= categoryData.entries.length - 1) {
                        next = 0;
                      } else {
                        next = lastI + 1;
                      }
                      break;
                    case "ArrowUp":
                      if (lastI <= 0) {
                        next = categoryData.entries.length - 1;
                      } else {
                        next = lastI - 1;
                      }
                      break;
                    // no default
                  }

                  setLastSelect(next);
                }
                break;
              case "Enter":
                {
                  const entry = categoryData.entries[lastSelect];

                  if (entry) {
                    input.current!.blur();
                    setInputFocused(false);
                    location.href = `/theatre/play?id=${entry.id}`;
                  }
                }
                break;
              default:
                preventDefault = false;
                break;
              // no default
            }

            if (preventDefault) {
              event.preventDefault();
            }
          }}
          onInput={(event) => {
            search((event.target as HTMLInputElement).value);
            setLastSelect(-1);
          }}
        />
      </div>
      <div
        className={styles.suggested}
        onMouseLeave={() => {
          setLastSelect(-1);
        }}
      >
        {renderSuggested &&
          categoryData.entries.map((entry, i) => (
            <a
              tabIndex={0}
              key={entry.id}
              href={`/theatre/play?id=${entry.id}`}
              onMouseOver={() => setLastSelect(i)}
              title={entry.name}
              data-hover={i === lastSelect || undefined}
            >
              <div className={styles.name}>{entry.name}</div>
              {showCategory && entry.category[0] && (
                <div className={styles.category}>
                  {
                    categories.find(
                      (category) => category.id === entry.category[0]
                    )?.name
                  }
                </div>
              )}
            </a>
          ))}
      </div>
    </div>
  );
};

export default SearchBar;
