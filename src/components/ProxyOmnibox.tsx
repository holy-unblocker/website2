import SearchBuilder from "@lib/SearchBuilder";
import type { ServiceFrameSrc } from "@components/ServiceFrame";
import ServiceFrame from "@components/ServiceFrame";
import themeStyles from "@styles/ThemeElements.module.scss";
import presentAboutBlank from "@lib/aboutBlank";
import { decryptURL, encryptURL } from "@lib/cryptURL";
import engines from "@lib/searchEngines";
import isAbortError from "@lib/isAbortError";
import styles from "@styles/ProxyOmnibox.module.scss";
import getTextContent from "@lib/textContent";
import NorthWest from "@icons/north_west_24dp.svg?react";
import Search from "@icons/search_24dp.svg?react";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSearchParams } from "@lib/searchParamsHook";
import { getGlobalSettings } from "@lib/storage";
import { createRef } from "preact";

// simple API used for fetching duckduckgo search results
async function sillyfetch(url: string, opts?: { signal: AbortSignal }) {
  const s = (await fetch("/api/sillyfetch", {
    method: "POST",
    body: url,
    signal: opts?.signal,
  })) as Response & { sillyurl: string };

  s.sillyurl = s.headers.get("x-url")!;

  return s;
}

const ProxyOmnibox = ({
  searchEngine,
  placeholder,
}: {
  searchEngine: number;
  placeholder?: string;
}) => {
  const input = useRef<HTMLInputElement | null>(null);
  const inputValue = useRef<string | null>(null);
  const lastInput = useRef<"select" | "input" | null>(null);
  const [lastSelect, setLastSelect] = useState(-1);
  const [omniboxEntries, setOmniboxEntries] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const abort = useRef(new AbortController());
  const engine = engines[searchEngine];
  const [search, setSearch] = useSearchParams();
  const [src, setSrc] = useState<ServiceFrameSrc | null>(null);

  // set src using search params on HYDRATE
  useEffect(() => {
    const qSrc = search.get("src");
    if (qSrc !== null) setSrc(JSON.parse(decryptURL(qSrc)));

    // allow querying eg ?q+hello+world
    const query = search.get("q");
    if (query !== null) {
      const src = new SearchBuilder(engine.format).query(query);
      setSrc([src, `/uv/service/${__uv$config.encodeUrl!(src)}`]);
    }
  }, []);

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
        if (!isAbortError(err)) {
          // likely abort error
          console.error("Error fetching silly server.");
          console.error(err);
        }
      }

    setOmniboxEntries(entries);
  }

  async function searchSubmit() {
    const value =
      lastSelect === -1 || lastInput.current === "input"
        ? input.current!.value
        : getTextContent(omniboxEntries[lastSelect]);

    input.current!.value = value;

    const builder = new SearchBuilder(engine.format);
    const src = builder.query(input.current!.value);

    setInputFocused(false);

    const uvPage = `/uv/service/${__uv$config.encodeUrl!(src)}`;

    switch (getGlobalSettings().get("proxyMode")) {
      case "embedded":
        setSrc([src, uvPage]);
        break;
      case "redirect":
        window.location.assign(uvPage);
        break;
      case "about:blank":
        presentAboutBlank(uvPage);
        break;
    }

    onInput();
  }

  const renderSuggested = inputFocused && omniboxEntries.length !== 0;

  const form = useRef<HTMLFormElement | null>(null);
  const suggested = useRef<HTMLDivElement | null>(null);

  return (
    <>
      {src !== null && (
        <ServiceFrame
          src={src}
          setSearch={(src) => {
            setSearch({
              src: src === null ? null : encryptURL(JSON.stringify(src)),
            });
            setSrc(src);
          }}
        />
      )}
      <form
        className={styles.omnibox}
        data-suggested={renderSuggested || undefined}
        data-focused={inputFocused || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          searchSubmit();
        }}
        ref={form}
      >
        <div className={`${themeStyles.ThemeInputBar} ${styles.inputBar}`}>
          <div
            dangerouslySetInnerHTML={{ __html: Search }}
            className={themeStyles.icon}
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
            onBlur={(event) => {
              if (!form.current!.contains(event.relatedTarget as Node)) {
                setInputFocused(false);
              }
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
          {omniboxEntries.map((entry, i) => {
            const text = createRef<HTMLSpanElement>();

            return (
              <div
                key={i}
                tabIndex={0}
                data-hover={i === lastSelect || undefined}
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
