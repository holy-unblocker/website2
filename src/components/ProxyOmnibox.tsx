import { resolveProxy } from "@lib/ProxyResolver";
import SearchBuilder from "@lib/SearchBuilder";
import type { ServiceFrameSrc } from "@components/ServiceFrame";
import ServiceFrame from "@components/ServiceFrame";
import themeStyles from "@styles/ThemeElements.module.scss";
import presentAboutBlank from "@lib/aboutBlank";
import { decryptURL, encryptURL } from "@lib/cryptURL";
import engines from "@lib/engines";
import isAbortError, { isFailedToFetch } from "@lib/isAbortError";
import styles from "@styles/ProxyOmnibox.module.scss";
import textContent from "@lib/textContent";
import NorthWest from "@icons/north_west_24dp.svg?react";
import Search from "@icons/search_24dp.svg?react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSearchParams } from "@lib/searchParamsHook";
import { globalSettings } from "@lib/storage";
import { sillyfetch } from "@lib/sillyfetch";
import { createRef } from "preact";
import { getSearchEngine } from "@lib/cookies";

const ProxyOmnibox = ({
  className,
  placeholder,
}: {
  className?: string;
  placeholder?: string;
}) => {
  const input = useRef<HTMLInputElement | null>(null);
  const inputValue = useRef<string | null>(null);
  const lastInput = useRef<"select" | "input" | null>(null);
  const [lastSelect, setLastSelect] = useState(-1);
  const [omniboxEntries, setOmniboxEntries] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const abort = useRef(new AbortController());
  const engine = engines[getSearchEngine()];
  const [search, setSearch] = useSearchParams();
  const [src, setSrc] = useState<ServiceFrameSrc | null>(null);

  useEffect(() => {
    // allow querying eg ?q+hello+world
    if (search.has("q")) {
      const src = new SearchBuilder(engine.format).query(search.get("q")!);
      setSrc([src, resolveProxy(src, globalSettings.get("proxy"))]);
    }
  }, [search, setSearch, engine]);

  useEffect(() => {
    // allow reusing src
    const qSrc = search.get("src");
    if (qSrc) setSrc(JSON.parse(decryptURL(qSrc)));
    // only do this on the first load bc search.src is updated later:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // update search.src
    // this won't trip the previous hook
    setSearch({
      src: src ? encryptURL(JSON.stringify(src)) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  async function onInput() {
    const v = input.current!.value;
    if (inputValue.current === v) return;
    inputValue.current = v;

    const entries: string[] = [];

    if (v.trim() !== "")
      try {
        abort.current.abort();
        abort.current = new AbortController();

        const outgoing = await sillyfetch(
          "https://www.bing.com/AS/Suggestions?" +
            new URLSearchParams({
              qry: v,
              cvid: "\u0001",
              bareServer: "",
            }),
          {
            signal: abort.current.signal,
          }
        );

        if (!outgoing.ok) {
          throw await outgoing.text();
        }

        const text = await outgoing.text();

        for (const [, phrase] of text.matchAll(
          /<span class="sa_tm_text">(.*?)<\/span>/g
        ))
          entries.push(phrase);
      } catch (err) {
        if (!isAbortError(err) && !isFailedToFetch(err)) {
          // likely abort error
          console.error("Error fetching silly server.");
        } else {
          throw err;
        }
      }

    setOmniboxEntries(entries);
  }

  async function searchSubmit() {
    const value =
      lastSelect === -1 || lastInput.current === "input"
        ? input.current!.value
        : textContent(omniboxEntries[lastSelect]);

    input.current!.value = value;

    const builder = new SearchBuilder(engine.format);
    const src = builder.query(input.current!.value);

    setInputFocused(false);

    const proxy = globalSettings.get("proxy");
    const s = resolveProxy(src, proxy);

    switch (globalSettings.get("proxyMode")) {
      case "embedded":
        setSrc([src, s]);
        break;
      case "redirect":
        window.location.assign(s);
        break;
      case "about:blank":
        presentAboutBlank(s);
        break;
    }

    onInput();
  }

  const renderSuggested = inputFocused && omniboxEntries.length !== 0;

  const form = useRef<HTMLFormElement | null>(null);
  const suggested = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <ServiceFrame src={src} close={() => setSrc(null)} />
      <form
        className={clsx(styles.omnibox, className)}
        data-suggested={Number(renderSuggested)}
        data-focused={Number(inputFocused)}
        onSubmit={(event) => {
          event.preventDefault();
          searchSubmit();
        }}
        onBlur={(event) => {
          if (!form.current!.contains(event.relatedTarget as Node)) {
            setInputFocused(false);
          }
        }}
        ref={form}
      >
        <div className={themeStyles.ThemeInputBar}>
          <div
            dangerouslySetInnerHTML={{ __html: Search }}
            className={clsx(themeStyles.icon, "icon-contents")}
          />
          <input
            type="text"
            placeholder={placeholder || `Search ${engine.name} or type a URL`}
            required={lastSelect === -1}
            autoComplete="off"
            className={themeStyles.thinPadLeft}
            ref={input}
            onInput={onInput}
            onFocus={() => {
              onInput();
              setInputFocused(true);
              setLastSelect(-1);
            }}
            onBlur={() => {
              setInputFocused(false);
            }}
            onClick={() => {
              onInput();
              setInputFocused(true);
              setLastSelect(-1);
            }}
            onChange={() => {
              lastInput.current = "input";
              setLastSelect(-1);
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

                    let next: number | undefined;

                    switch (event.code) {
                      case "ArrowDown":
                        if (lastI >= omniboxEntries.length - 1) {
                          next = 0;
                        } else {
                          next = lastI + 1;
                        }
                        break;
                      case "ArrowUp":
                        if (lastI <= 0) {
                          next = omniboxEntries.length - 1;
                        } else {
                          next = lastI - 1;
                        }
                        break;
                      // no default
                    }

                    lastInput.current = "select";

                    setLastSelect(next);
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
          />
        </div>
        <div
          ref={suggested}
          className={styles.suggested}
          onMouseLeave={() => {
            setLastSelect(-1);
          }}
        >
          {renderSuggested &&
            omniboxEntries.map((entry, i) => {
              const text = createRef<HTMLSpanElement>();

              return (
                <div
                  key={i}
                  tabIndex={0}
                  className={clsx(
                    styles.option,
                    i === lastSelect && styles.hover
                  )}
                  onClick={() => {
                    lastInput.current = "select";
                    input.current!.value = text.current!.textContent!;
                    searchSubmit();
                  }}
                  onMouseOver={() => {
                    setLastSelect(i);
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: Search }}
                    className={styles.search}
                  />
                  <span
                    className={styles.text}
                    ref={text}
                    dangerouslySetInnerHTML={{
                      __html: entry,
                    }}
                  />
                  <div
                    dangerouslySetInnerHTML={{ __html: NorthWest }}
                    className={styles.open}
                  />
                </div>
              );
            })}
        </div>
      </form>
    </>
  );
};

export default ProxyOmnibox;
