import { readFile } from "node:fs/promises";
import { optimize } from "svgo";

// based on https://github.com/withastro/roadmap/discussions/667#discussioncomment-6926854

const EXPORTS_DEFAULT = "export default ";

/**
 * @returns {import('vite').Plugin}
 */
export function svga() {
  return {
    enforce: "pre",
    name: "astro:svga",
    async transform(code, id) {
      if (!id.endsWith(".svg?svgmin")) {
        return null;
      }

      const runtimePath = "astro/runtime/server/index.js";

      let idx = id;
      let codex = code;

      // remove the annoying querystring
      idx = id.replace("?svgmin", "");

      // this is because the `@astrojs/image` transforms the file already
      // and replaces with the url to load instead of the real source
      if (code.startsWith(EXPORTS_DEFAULT)) {
        codex = code.replace(EXPORTS_DEFAULT, "");
        codex = await readFile(idx, "utf-8");
      }

      // optimize the svg
      // codex = optimize(codex).data;

      const template = /*ts*/ `import {
				render,
				createAstro,
				createComponent,
				spreadAttributes,
			  } from "${runtimePath.toString()}";
			  
			  const Astro = createAstro();
			  
			  const SVG = createComponent(async (result, props, slots) => {
				const _Astro = result.createAstro(Astro, props, slots);
				Astro.self = SVG;
				return render\`<svg \${spreadAttributes(_Astro.props, "props")}%%svg%%\`;
			  }, "%%id%%");
			  
			  ${EXPORTS_DEFAULT}SVG;
			  
			  if (import.meta.hot) import.meta.hot.decline()`;

      const resolved = template
        .replace("%%id%%", idx)
        // the `<svg` is already in the template since we want to spread Astro props.
        .replace("%%svg%%", codex.replace("<svg", ""));

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
