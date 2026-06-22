import fs from "node:fs/promises";
import JSObfuscator from "javascript-obfuscator";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getObfuscatedVendorPath,
  getVendorAssetRegistry,
  obfuscatedVendorRoot,
} from "./src/lib/proxyRoutes.js";

/**
 * @typedef {Object} AstroObfuscatorOptions
 * @property {import("javascript-obfuscator").ObfuscatorOptions} [obfuscator] - Options for the javascript-obfuscator.
 * @property {RegExp[]} [excludes] - Array of regular expressions to exclude files from obfuscation.
 * @property {boolean} [disableFilesLog] - Whether to disable logging the files being obfuscated.
 */

/**
 * Astro integration to obfuscate JavaScript client files using javascript-obfuscator.
 *
 * @param {AstroObfuscatorOptions} [opts] - Options for the obfuscator and file exclusions.
 * @returns {import("astro").AstroIntegration} An Astro integration object.
 */
export default function obfuscator(opts) {
  const obfuscatorOptions = {
    ...JSObfuscator.getOptionsByPreset("low-obfuscation"),
    ...opts?.obfuscator,
  };

  const excludes = opts?.excludes || [];

  function isScript(filePath) {
    return [".js", ".mjs", ".cjs"].includes(extname(filePath));
  }

  async function walk(dir, out = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) await walk(p, out);
      else if (isScript(ent.name)) out.push(p);
    }
    return out;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function reservedVendorStrings(currentPublicPath) {
    const paths = [...getVendorAssetRegistry().keys()];
    const reserved = new Set([
      "__uv$config",
      "$scramjet",
      "$scramjetController",
      "/scram/service/",
      "/sw.js",
    ]);

    for (const publicPath of paths) {
      reserved.add(publicPath);
    }

    if (currentPublicPath) {
      const currentDir = currentPublicPath.slice(
        0,
        currentPublicPath.lastIndexOf("/"),
      );
      for (const publicPath of paths) {
        if (publicPath === currentPublicPath) continue;
        if (!publicPath.startsWith(`${currentDir}/`)) continue;
        const relative = publicPath.slice(currentDir.length + 1);
        if (!relative) continue;
        reserved.add(relative);
        reserved.add(`./${relative}`);
      }
    }

    return [...reserved].map(escapeRegExp);
  }

  /**
   *
   * @returns {import("javascript-obfuscator").ObfuscatorOptions}
   */
  function optionsForVendor(currentPublicPath) {
    return {
      ...obfuscatorOptions,
      renameProperties: true,
      stringArrayEncoding: ["rc4"],
      stringArray: true,
      stringArrayThreshold: 1,
      reservedNames: [
        ...(obfuscatorOptions.reservedNames || []),
        "^__uv\\$config$",
        "^\\$scramjet$",
        "^\\$scramjetController$",
        "^UVServiceWorker$",
        "^Ultraviolet$",
      ],
      reservedStrings: [
        ...(obfuscatorOptions.reservedStrings || []),
        ...reservedVendorStrings(currentPublicPath),
      ],
    };
  }

  function patchScramjetControllerWorker(source) {
    const scramjetConfigPrefix = `globalThis[${JSON.stringify(
      "$scramjet",
    )}].config.prefix`;
    const patched = source.replace(
      "headers:n.headers",
      `headers:((e,s)=>{let t=new Headers,r=Array.isArray(e)?e:Object.entries(e||{});for(let[e,o]of r){if(Array.isArray(o))t.append(o[0],o[1]);else if(/^\\d+$/.test(e)){let s=String(o),r=s.indexOf(',');r>0&&t.append(s.slice(0,r),s.slice(r+1))}else t.append(e,String(o))}let o=t.get('location');if(o){try{let e=new URL(o,s),r='/'+encodeURIComponent(e.href);t.set('location',location.origin+${scramjetConfigPrefix}+'x/'+r)}catch{}}return t})(n.headers,o&&o.url)`,
    );
    if (patched === source) {
      throw new Error("Unable to patch Scramjet controller worker headers.");
    }
    return patched;
  }

  function patchUltravioletWorker(source) {
    const patched = source.replace(
      "for(let t in o.rawHeaders)this.headers[t.toLowerCase()]=o.rawHeaders[t]",
      "for(let t in o.rawHeaders){let e=o.rawHeaders[t];if(Array.isArray(e))this.headers[String(e[0]).toLowerCase()]=e[1];else if(/^\\d+$/.test(t)){let o=String(e),r=o.indexOf(',');r>0&&(this.headers[o.slice(0,r).toLowerCase()]=o.slice(r+1))}else this.headers[t.toLowerCase()]=e}",
    );
    if (patched === source) {
      throw new Error("Unable to patch Ultraviolet worker raw headers.");
    }
    return patched;
  }

  function patchVendorSource(source, publicPath) {
    if (publicPath.startsWith("/scram/")) {
      source = source
        .replaceAll(
          String.raw`/(?i:url)\(['"]?(.+?)['"]?\)/gm`,
          String.raw`/url\(['"]?(.+?)['"]?\)/gim`,
        )
        .replaceAll(
          String.raw`/@import\s+((?i:url)\s*?\(.{0,9999}?\)|['"].{0,9999}?['"]|.{0,9999}?)($|\s|;)/gm`,
          String.raw`/@import\s+(url\s*?\(.{0,9999}?\)|['"].{0,9999}?['"]|.{0,9999}?)($|\s|;)/gim`,
        );
    }
    if (publicPath === "/uv/uv.sw.js") return patchUltravioletWorker(source);
    if (publicPath === "/scramjet/controller.sw.js") {
      return patchScramjetControllerWorker(source);
    }
    return source;
  }

  async function obfuscateFile(f, root, logger, options = obfuscatorOptions) {
    const code = await fs.readFile(f, "utf8");
    const obf = JSObfuscator.obfuscate(code, options).getObfuscatedCode();
    await fs.writeFile(f, obf);

    if (!opts?.disableFilesLog) {
      const originalSize = Buffer.byteLength(code, "utf8");
      const obfuscatedSize = Buffer.byteLength(obf, "utf8");
      let sizeDiff = ((obfuscatedSize - originalSize) / obfuscatedSize) * 100;
      if (isNaN(sizeDiff) || !isFinite(sizeDiff)) {
        sizeDiff = 0;
      }

      logger.info(
        `\x1b[90m${f.replace(root, "")}\x1b[0m \x1b[1m\x1b[97m${sizeDiff.toFixed(1)}%\x1b[0m`,
      );
    }
  }

  async function obfuscateVendorAssets(logger) {
    await fs.rm(obfuscatedVendorRoot, { force: true, recursive: true });

    const vendorFiles = [...getVendorAssetRegistry().values()].filter((asset) =>
      isScript(asset.filePath),
    );

    await Promise.all(
      vendorFiles.map(async (asset) => {
        const outPath = getObfuscatedVendorPath(asset.publicPath);
        await fs.mkdir(dirname(outPath), { recursive: true });

        const source = patchVendorSource(
          await fs.readFile(asset.filePath, "utf8"),
          asset.publicPath,
        );
        const obf = JSObfuscator.obfuscate(
          source,
          optionsForVendor(asset.publicPath),
        ).getObfuscatedCode();
        await fs.writeFile(outPath, obf);

        if (!opts?.disableFilesLog) {
          const originalSize = Buffer.byteLength(source, "utf8");
          const obfuscatedSize = Buffer.byteLength(obf, "utf8");
          let sizeDiff =
            ((obfuscatedSize - originalSize) / obfuscatedSize) * 100;
          if (isNaN(sizeDiff) || !isFinite(sizeDiff)) {
            sizeDiff = 0;
          }

          logger.info(
            `\x1b[90m/_proxy-vendor${asset.publicPath}\x1b[0m \x1b[1m\x1b[97m${sizeDiff.toFixed(1)}%\x1b[0m`,
          );
        }
      }),
    );

    logger.info(
      `\x1b[32m\u2713 ${vendorFiles.length} vendor files obfuscated.\x1b[0m`,
    );
  }

  return {
    name: "astro-obfuscator",
    hooks: {
      "astro:build:done": async ({ logger, dir }) => {
        const root = fileURLToPath(dir);

        let files = (await walk(root)).filter(
          (f) => !f.startsWith(obfuscatedVendorRoot),
        );

        if (excludes.length > 0) {
          files = files.filter((f) => !excludes.some((re) => re.test(f)));
        }

        await Promise.all(files.map((f) => obfuscateFile(f, root, logger)));
        await obfuscateVendorAssets(logger);

        logger.info(`\x1b[32m\u2713 ${files.length} files obfuscated.\x1b[0m`);
      },
    },
  };
}
