// loaded on client
import CryptoJS from "crypto-js";

let key: string;

const loadKey = () => {
  const e = document.getElementById("eckey")!;
  key = e.innerHTML;
};

loadKey();
document.addEventListener("astro:page-load", loadKey);

export const holyDecrypt = (text: string) => {
  return CryptoJS.AES.decrypt(text, key).toString(CryptoJS.enc.Utf8);
};
