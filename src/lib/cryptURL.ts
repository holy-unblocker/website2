// encrypting/decrypt parts of the URL
// particularly proxy,compat
import { fromBase64, toBase64 } from "@smithy/util-base64";
import { cbc } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";

let key: Uint8Array | undefined;

function getKey(): Uint8Array {
  if (key !== undefined) return key;

  let savedKey = localStorage.getItem("aes_key");
  if (savedKey !== null) return fromBase64(savedKey);

  key = randomBytes(32);
  localStorage.setItem("aes_key", toBase64(key));
  return key;
}

const txtenc = new TextEncoder();
const txtdec = new TextDecoder();

export function encryptURL(part: string) {
  const iv = randomBytes(16);
  const stream = cbc(getKey(), iv);
  const cipherText = stream.encrypt(txtenc.encode(part));
  const out = new Uint8Array(16 + cipherText.byteLength);
  out.set(iv);
  out.set(cipherText, 16);
  return toBase64(out);
}

export function decryptURL(part: string) {
  const data = fromBase64(part);
  const iv = data.slice(0, 16);
  const cipherText = data.slice(16);
  const stream = cbc(getKey(), iv);
  return txtdec.decode(stream.decrypt(cipherText));
}
