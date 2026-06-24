// loaded on client
import { fromBase64 } from "@smithy/util-base64";
import { cbc } from "@noble/ciphers/aes.js";

let key: Uint8Array | undefined;

// Read the current page's key from the DOM. The element is left in place so it
// stays available for every decrypt on this page; each navigation renders a
// fresh #eckey, and we re-sync the cache from it whenever it's present.
const loadKey = () => {
  const e = document.getElementById("eckey");
  if (e === null) return false;
  key = fromBase64(e.innerHTML);
  return true;
};

loadKey();
document.addEventListener("astro:page-load", loadKey);

const txtdec = new TextDecoder();

export const holyDecrypt = (text: string) => {
  // Always trust the DOM's current key if present. getSiteConfig and similar
  // callers can run synchronously after a client-side navigation, before
  // astro:page-load fires, so the cached key may belong to the previous page
  // while the ciphertext belongs to the new one. Re-reading here keeps the key
  // in sync with the ciphertext that was just rendered.
  if (!loadKey() && key === undefined)
    throw new Error("key isn't ready yet,. PLEASE WAIT");
  const cipherText = fromBase64(text);
  const stream = cbc(key!.slice(16), key!.slice(0, 16));
  return txtdec.decode(stream.decrypt(cipherText));
};
