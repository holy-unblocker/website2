// loaded on client
import aes from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

let key: string;

const loadKey = () => {
  const e = document.getElementById("eckey")!;
  if (e === null) return false;
  key = e.innerHTML;
  e.remove();
  return true;
};

loadKey();
document.addEventListener("astro:page-load", loadKey);

export const holyDecrypt = (text: string) => {
  if (key === undefined) {
    if (!loadKey()) throw new Error("key isn't ready yet,. PLEASE WAIT");
  }
  return aes.decrypt(text, key).toString(Utf8);
};
