// encrypting/decrypt parts of the URL
// particularly proxy,compat
import aes from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

function getEncryptionKey() {
  let key: string | undefined = localStorage["cryptURL key"];
  if (key === undefined) {
    key = Math.random().toString(36).slice(2);
    localStorage["cryptURL key"] = key;
  }
  return key;
}

export function encryptURL(part: string) {
  return aes.encrypt(part, getEncryptionKey()).toString();
}

export function decryptURL(part: string) {
  return aes.decrypt(part, getEncryptionKey()).toString(Utf8);
}
