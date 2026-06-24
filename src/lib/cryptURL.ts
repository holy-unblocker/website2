// encrypting/decrypt parts of the URL
// particularly proxy,compat
import { fromBase64, toBase64 } from "@smithy/util-base64";
import { cbc } from "@noble/ciphers/aes.js";

let key: Uint8Array | undefined;

export function getURLKey(): Uint8Array {
  if (key !== undefined) return key;

  let savedKey = localStorage.getItem("aes_key2");
  if (savedKey !== null) {
    key = fromBase64(savedKey);
    return key;
  }

  key = crypto.getRandomValues(new Uint8Array(32 + 16));
  localStorage.setItem("aes_key2", toBase64(key));
  return key;
}

export function getURLKeyBase64(): string {
  getURLKey();
  return localStorage.getItem("aes_key2")!;
}

const txtenc = new TextEncoder();
const txtdec = new TextDecoder();

export function encryptURL(part: string) {
  const fullKey = getURLKey();
  const key = fullKey.slice(0, 32);
  const iv = fullKey.slice(32);
  const stream = cbc(key, iv);
  const cipherText = stream.encrypt(txtenc.encode(part));
  return toBase64(cipherText);
}

export function decryptURL(part: string) {
  const data = fromBase64(part);
  const fullKey = getURLKey();
  const key = fullKey.slice(0, 32);
  const iv = fullKey.slice(32);
  const stream = cbc(key, iv);
  return txtdec.decode(stream.decrypt(data));
}
