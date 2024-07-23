// loaded on client
import CryptoJS from "crypto-js";

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
  return CryptoJS.AES.decrypt(text, key).toString(CryptoJS.enc.Utf8);
};
