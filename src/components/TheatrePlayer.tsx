import CommonError from "@components/CommonError";
import resolveProxy from "@lib/ProxyResolver";
import { TheatreAPI } from "@components/TheatreCommon";
import type { TheatreEntry } from "@components/TheatreCommon";
import { encryptURL } from "@lib/cryptURL";
import isAbortError from "@lib/isAbortError";
import styles from "@styles/TheatrePlayer.module.scss";
import ArrowDropDown from "@icons/arrow_drop_down_24dp.svg?react";
import ArrowDropUp from "@icons/arrow_drop_up_24dp.svg?react";
import ArrowLeft from "@icons/arrow_left_24dp.svg?react";
import ArrowRight from "@icons/arrow_right_24dp.svg?react";
import ChevronLeft from "@icons/chevron_left_24dp.svg?react";
import Close from "@icons/close_24dp.svg?react";
import Fullscreen from "@icons/fullscreen_24dp.svg?react";
import Panorama from "@icons/panorama_24dp.svg?react";
import Star from "@icons/star_24dp.svg?react";
import StarBorder from "@icons/star_outline_24dp.svg?react";
import VideogameAsset from "@icons/videogame_asset_24dp.svg?react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGlobalSettings } from "@lib/storage";

async function resolveSrc(
  src: TheatreEntry["src"],
  type: TheatreEntry["type"]
) {
  switch (type) {
    case "proxy":
      return await resolveProxy(src, "automatic");
    case "embed":
      return src;
    case "flash":
      return `/compact/flash#${encryptURL(src)}`;
    case "emulator":
    case "emulator.gba":
    case "emulator.nes":
    case "emulator.n64":
    case "emulator.genesis":
      return (
        "/cdn/html5/webretro/?" +
        new URLSearchParams({
          rom: src,
          core: "autodetect",
        })
      );
    default:
      throw new TypeError(`Unrecognized target: ${type}`);
  }
}

// Play ... may not be appropiate for apps
// Play TikTok
/*const PlayerMeta = ({ name }: { name?: string }) => (
  <Meta
    title={name || "Player"}
    description={name ? `${name} on Holy Unblocker.` : undefined}
  />
);*/

const TheatrePlayer = ({ data }: { data: TheatreEntry }) => {
  const [settings, setSettings] = useGlobalSettings();
  const [favorited, setFavorited] = useState(() =>
    settings.favorites.includes(data.id)
  );
  const [panorama, setPanorama] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [error, setError] = useState<{
    cause?: string;
    message: string;
  } | null>(null);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const controlsOpen = useRef<HTMLDivElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const controlsPopup = useRef<HTMLDivElement | null>(null);
  const [iframeFocused, setIFrameFocused] = useState(true);

  useEffect(() => {
    const abort = new AbortController();

    (async function () {
      let errorCause: string | undefined;

      const api = new TheatreAPI(window.db_api, abort.signal);

      try {
        errorCause = undefined;
        errorCause = "Unable to determine proxy/location";
        const resolvedSrc = await resolveSrc(
          new URL(data.src, window.theatre_cdn).toString(),
          data.type
        );
        errorCause = undefined;
        setResolvedSrc(resolvedSrc);

        if (!settings.seenGames.includes(data.id)) {
          errorCause = "Unable to count play";
          await api.plays(data.id);
          const { seenGames } = settings;
          seenGames.push(data.id);
          setSettings({
            ...settings,
            seenGames,
          });

          errorCause = undefined;
        }
      } catch (err) {
        if (!isAbortError(err)) {
          console.error(err);
          setError({
            cause: errorCause,
            message: String(err),
          });
        }
      }
    })();

    return () => abort.abort();
  }, [data, settings, setSettings]);

  useEffect(() => {
    function focusListener() {
      if (iframeFocused && iframe.current) iframe.current.focus();
    }

    if (iframeFocused && iframe.current) iframe.current.focus();

    document.documentElement.dataset.lockFrameScroll =
      Number(iframeFocused).toString();
    window.addEventListener("focus", focusListener);

    return () => {
      window.removeEventListener("focus", focusListener);
      delete document.documentElement.dataset.scroll;
    };
  }, [iframeFocused, iframe]);

  useEffect(() => {
    if (!iframe.current) return;

    function clickListener() {
      if (iframeFocused) setIFrameFocused(false);
    }

    if (iframeFocused) {
      document.documentElement.scrollTo(0, 0);
    } else {
      iframe.current!.blur();
    }

    // window.addEventListener('blur', blurListener);
    window.addEventListener("click", clickListener);
    document.documentElement.dataset.lockFrameScroll =
      Number(iframeFocused).toString();

    return () => {
      delete document.documentElement.dataset.lockFrameScroll;
      window.removeEventListener("click", clickListener);
    };
  }, [data, iframeFocused]);

  useEffect(() => {
    const listener = () => {
      setIFrameFocused(document.fullscreenElement === iframe.current);
    };

    document.addEventListener("fullscreenchange", listener);

    return () => {
      document.removeEventListener("fullscreenchange", listener);
    };
  }, []);

  if (error)
    return (
      <>
        <CommonError
          cause={error.cause}
          error={error.message}
          message="An error occurred while loading the app/game"
        />
      </>
    );

  const controls = [];

  for (const control of data.controls) {
    const visuals = [];

    for (const key of control.keys) {
      switch (key) {
        case "arrows":
          visuals.push(
            <div key={key} className={styles.move}>
              <div
                className={styles.controlKey}
                dangerouslySetInnerHTML={{ __html: ArrowDropUp }}
              />
              <div
                className={styles.controlKey}
                dangerouslySetInnerHTML={{ __html: ArrowLeft }}
              />
              <div
                className={styles.controlKey}
                dangerouslySetInnerHTML={{ __html: ArrowDropDown }}
              />
              <div
                className={styles.controlKey}
                dangerouslySetInnerHTML={{ __html: ArrowRight }}
              />
            </div>
          );
          break;
        case "wasd":
          visuals.push(
            <div key={key} className={styles.move}>
              <div className={styles.controlKey}>W</div>
              <div className={styles.controlKey}>A</div>
              <div className={styles.controlKey}>S</div>
              <div className={styles.controlKey}>D</div>
            </div>
          );
          break;
        default:
          visuals.push(
            <div
              key={key}
              className={clsx(styles.controlKey, styles[`key${key}`])}
            >
              {key}
            </div>
          );
          break;
      }
    }

    controls.push(
      <div key={control.label} className={styles.control}>
        <div className={styles.visuals}>{visuals}</div>
        <span className={styles.label}>{control.label}</span>
      </div>
    );
  }

  return (
    <>
      <main
        className={styles.main}
        data-panorama={Number(panorama)}
        data-controls={Number(controlsExpanded)}
      >
        <div className={styles.frame}>
          <div className={styles.iframeContainer}>
            <div
              className={styles.iframeCover}
              title="Click to focus"
              onClick={(event) => {
                event.stopPropagation();
                setIFrameFocused(true);
              }}
            />
            <iframe ref={iframe} title="Embed" src={resolvedSrc || undefined} />
          </div>
          <div
            tabIndex={0}
            className={styles.controls}
            ref={controlsPopup}
            onBlur={(event) => {
              if (
                !(event.target as HTMLDivElement).contains(
                  event.relatedTarget as Node
                ) &&
                !controlsOpen.current!.contains(event.relatedTarget as Node)
              ) {
                setControlsExpanded(false);
              }
            }}
          >
            <div
              className={styles.close}
              onClick={() => setControlsExpanded(false)}
              dangerouslySetInnerHTML={{ __html: Close }}
            />
            <div className={styles.controls}>{controls}</div>
          </div>
        </div>
        <div className={styles.title}>
          <h3 className={styles.name}>{data.name}</h3>
          <div className={styles.shiftRight}></div>
          <div
            className={styles.button}
            onClick={() => {
              iframe.current!.requestFullscreen();
            }}
            title="Fullscreen mode"
            dangerouslySetInnerHTML={{ __html: Fullscreen }}
          />
          {controls.length !== 0 && (
            <div
              className={styles.button}
              tabIndex={0}
              ref={controlsOpen}
              onClick={async () => {
                setControlsExpanded(!controlsExpanded);
                controlsPopup.current!.focus();
              }}
              title="Controls"
              dangerouslySetInnerHTML={{ __html: VideogameAsset }}
            />
          )}
          <div
            className={styles.button}
            onClick={() => {
              const favorites = settings.favorites;
              const i = favorites.indexOf(data.id);

              if (i === -1) {
                favorites.push(data.id);
              } else {
                favorites.splice(i, 1);
              }

              setSettings({
                ...settings,
                favorites,
              });

              setFavorited(favorites.includes(data.id));
            }}
            title="Add to favorites"
            dangerouslySetInnerHTML={{ __html: favorited ? Star : StarBorder }}
          />
          <div
            className={styles.button}
            onClick={async () => {
              setPanorama(!panorama);
            }}
            title="Panorama mode"
            dangerouslySetInnerHTML={{
              __html: panorama ? ChevronLeft : Panorama,
            }}
          />
        </div>
      </main>
    </>
  );
};

export default TheatrePlayer;
