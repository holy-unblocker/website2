import styles from "@styles/Service.module.scss";
import ChevronLeft from "@icons/chevron_left_24dp.svg?react";
import Fullscreen from "@icons/fullscreen_24dp.svg?react";
import OpenInNew from "@icons/open_in_new_24dp.svg?react";
import Public from "@icons/public_24dp.svg?react";
import { useRef } from "preact/hooks";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { sillyfetch } from "@lib/sillyfetch";

export type ServiceFrameSrc = [src: string, uvPage: string];

const ServiceFrame = ({
  // layout,
  src,
  setSearch,
}: {
  // layout: LayoutDump["layout"];
  src: ServiceFrameSrc;
  setSearch: (src: ServiceFrameSrc | null) => void;
}) => {
  if (src === null) throw new Error("fuck");
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const [firstLoad, setFirstLoad] = useState(false);
  const [revokeIcon, setRevokeIcon] = useState(false);
  const lastSrc = useRef<string>(src[0]);
  //  const bare = useMemo(() => new BareClient(BARE_API), []);
  const linksTried = useMemo(() => new WeakMap(), []);
  const [title, setTitle] = useState<string | null>(src?.[0] || null);
  const [icon, setIcon] = useState("");

  useEffect(() => {
    if (!iframe.current || !iframe.current.contentWindow) return;
    iframe.current.contentWindow.location.href = src[1];
    setSearch(src);
  }, [iframe, src]);

  useEffect(() => {
    function focusListener() {
      if (!iframe.current || !iframe.current.contentWindow) return;

      iframe.current.contentWindow.focus();
    }

    window.addEventListener("focus", focusListener);

    return () => window.removeEventListener("focus", focusListener);
  }, [iframe]);

  const testProxyUpdate = useCallback(
    async function testProxyUpdate() {
      if (!iframe.current || !iframe.current.contentWindow) return;

      const contentWindow = iframe.current
        .contentWindow as unknown as typeof globalThis;

      // * didn't hook our call to new Function
      try {
        const newsrc = contentWindow.location.href;
        if (newsrc !== src[1]) {
          src[1] = newsrc;
          setSearch(src);
        }
      } catch (err) {
        // possibly an x-frame error
        return;
      }

      const location = new contentWindow.Function("return location")();

      if (location === contentWindow.location) setTitle(src[0] || null);
      else {
        const currentTitle = contentWindow.document.title;

        setTitle(currentTitle || location.toString());
        const selector = contentWindow.document.querySelector(
          'link[rel*="icon"]'
        ) as HTMLLinkElement | null;

        const icon =
          selector && selector.href !== ""
            ? selector.href
            : new URL("/favicon.ico", location).toString();

        if (!linksTried.has(location)) linksTried.set(location, new Set());

        if (!linksTried.get(location).has(icon)) {
          linksTried.get(location).add(icon);

          const outgoing = await sillyfetch(icon);

          setIcon(URL.createObjectURL(await outgoing.blob()));
          setRevokeIcon(true);
        }
      }
    },
    [iframe, linksTried, src]
  );

  useEffect(() => {
    const interval = setInterval(testProxyUpdate, 50);
    testProxyUpdate();
    return () => clearInterval(interval);
  }, [testProxyUpdate]);

  useEffect(() => {
    document.documentElement.setAttribute("data-service", "");

    return () => {
      document.documentElement.removeAttribute("data-service");
    };
  }, [src]);

  return (
    <div className={styles.service}>
      <div className={styles.buttons}>
        <div
          dangerouslySetInnerHTML={{ __html: ChevronLeft }}
          className={styles.button}
          onClick={() => {
            setSearch(null);
          }}
        />
        {icon ? (
          <img
            className={styles.tabicon}
            alt=""
            src={icon}
            onError={() => setIcon("")}
            onLoad={() => {
              if (revokeIcon) {
                URL.revokeObjectURL(icon);
                setRevokeIcon(false);
              }
            }}
          />
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: Public }}
            className={styles.defaulttabicon}
          />
        )}
        <p className={styles.title}>{title}</p>
        <div className={styles.shiftRight}></div>
        <a
          onClick={() =>
            window.open(
              `/uv/service/${__uv$config.encodeUrl!(lastSrc.current)}`
            )
          }
          className={styles.button}
          dangerouslySetInnerHTML={{ __html: OpenInNew }}
        />
        <div
          className={styles.button}
          onClick={() => iframe.current && iframe.current.requestFullscreen()}
          dangerouslySetInnerHTML={{ __html: Fullscreen }}
        />
      </div>
      <iframe
        className={styles.embed}
        title="embed"
        ref={iframe}
        data-first-load={firstLoad || undefined}
        onLoad={() => {
          testProxyUpdate();

          if (src) {
            setFirstLoad(true);
          }
        }}
      />
    </div>
  );
};

export default ServiceFrame;
