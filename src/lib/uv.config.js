var keyCache;
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();

function fromBase64(value) {
  var binary = atob(value);
  var out = new Uint8Array(binary.length);
  for (var index = 0; index < binary.length; index++) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}

function toBase64(value) {
  var binary = "";
  for (var index = 0; index < value.length; index++) {
    binary += String.fromCharCode(value[index]);
  }
  return btoa(binary);
}

function resolveKey() {
  if (keyCache) return keyCache;

  var raw;
  try {
    if (typeof localStorage !== "undefined") {
      raw = localStorage.getItem("aes_key2");
    }
  } catch {}

  if (!raw) {
    try {
      raw = new URL(self.location.href).searchParams.get("key");
    } catch {}
  }

  if (!raw) throw new Error("Missing URL encryption key.");
  keyCache = fromBase64(raw);
  return keyCache;
}

function crypt(input) {
  var key = resolveKey();
  var out = new Uint8Array(input.length);
  for (var index = 0; index < input.length; index++) {
    out[index] =
      input[index] ^
      key[index % key.length] ^
      ((index * 31 + key[(index + 17) % key.length]) & 255);
  }
  return out;
}

function encodeUrl(value) {
  return encodeURIComponent(toBase64(crypt(textEncoder.encode(value))));
}

function decodeUrl(value) {
  return textDecoder.decode(crypt(fromBase64(decodeURIComponent(value))));
}

self["%{UV_CONFIG_GLOBAL}"] = {
  prefix: "%{UV_PREFIX}",
  encodeUrl: encodeUrl,
  decodeUrl: decodeUrl,
  handler: "%{UV_HANDLER}",
  bundle: "%{UV_BUNDLE}",
  config: "%{UV_CONFIG}",
  client: "%{UV_CLIENT}",
  sw: "%{UV_SW}",
};
