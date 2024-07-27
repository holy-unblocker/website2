import { readFile } from "node:fs/promises";
import { optimize } from "svgo";

// based on https://github.com/withastro/roadmap/discussions/667#discussioncomment-6926854

const EXPORTS_DEFAULT = "export default ";

/**
 * @returns {import('vite').Plugin}
 */
export function svgr() {
  return {
    enforce: "pre",
    name: "astro:svga",
    async transform(code, id) {
      if (!id.endsWith(".svg?react")) {
        return null;
      }

      let idx = id;
      let codex = code;

      // remove the annoying querystring
      idx = id.replace(/\?react$/, "");

      // this is because the `@astrojs/image` transforms the file already
      // and replaces with the url to load instead of the real source
      if (code.startsWith(EXPORTS_DEFAULT)) {
        codex = code.replace(EXPORTS_DEFAULT, "");
        codex = await readFile(idx, "utf-8");
      }

      // optimize the svg
      codex = optimize(codex).data;

      const resolved = `const SVG = ${JSON.stringify(codex)};
export default SVG;
if (import.meta.hot) import.meta.hot.decline();`;

      return {
        code: resolved,
        meta: {
          astro: {
            hydratedComponents: [],
            clientOnlyComponents: [],
            scripts: [],
            propagation: "none",
            containsHead: false,
            pageOptions: {},
          },
          vite: {
            lang: "ts",
          },
        },
      };
    },
  };
}
