import { decryptURL } from "@lib/cryptURL";

/**
 *
 * @param location Derived from useLocation
 * @returns
 */
export const getCompatDest = () => {
  if (location.hash === "") throw new Error("No hash was provided");

  try {
    return decryptURL(location.hash.slice(1));
  } catch (err) {
    throw new Error("Failed to decrypt destination");
  }
};

export function reportCompatError(
  error: any,
  cause: string | undefined,
  what: string,
) {
  console.log(error, cause);
  const container = document.querySelector<HTMLElement>("main")!;
  container.innerHTML = "";
  const p = document.createElement("p");
  container.append(p);
  p.textContent = `An error occurred while loading ${what}`;

  if (cause) {
    const pre = document.createElement("pre");
    container.append(pre);
    pre.textContent = cause;
  }

  const pre = document.createElement("pre");
  container.append(pre);
  pre.textContent = error;
}
