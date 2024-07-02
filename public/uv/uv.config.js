self.__uv$config = {
  wisp: `https://api.${location.host}/wisp/`,
  prefix: `/uv/service/`,
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: `/uv/uv.handler.js`,
  bundle: `/uv/uv.bundle.js`,
  config: `/uv/uv.config.js`,
  client: `/uv/uv.client.js`,
  sw: `/uv/uv.sw.js`,
};
