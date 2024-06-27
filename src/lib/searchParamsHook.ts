import { useState, useEffect } from "preact/hooks";

/**
 * SET THE PROPERTY VALUE TO NULL TO DELETE IT FROM SEARCH PARAMS
 */
export function useSearchParams(): [
  URLSearchParams,
  (value: Record<string, any>) => void
] {
  const [params, setParams] = useState(
    () => new URLSearchParams(location.search)
  );

  useEffect(() => {
    setParams(new URLSearchParams(location.search));
  }, [location.search]);

  return [
    params,
    (value: Record<string, string | number | null>) => {
      const newParams = new URLSearchParams(params.toString());
      for (const key in value) {
        if (value[key] === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value[key]));
        }
      }
      const st = newParams.toString();
      history.pushState(
        {},
        "",
        st === "" ? location.pathname : `${location.pathname}?${st}`
      );
    },
  ];
}
