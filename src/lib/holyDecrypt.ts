// loaded on client
import { fromBase64 } from "@smithy/util-base64";
import { cbc } from "@noble/ciphers/aes";

let key: Uint8Array;

const loadKey = () => {
  const e = document.getElementById("eckey")!;
  if (e === null) return false;
  key = fromBase64(e.innerHTML);
  e.remove();
  return true;
};

loadKey();
document.addEventListener("astro:page-load", loadKey);

const txtdec = new TextDecoder();

export const holyDecrypt = (text: string) => {
  if (key === undefined)
    if (!loadKey()) throw new Error("key isn't ready yet,. PLEASE WAIT");
  const cipherText = fromBase64(text);
  const stream = cbc(key.slice(16), key.slice(0, 16));
  return txtdec.decode(stream.decrypt(cipherText));
};
