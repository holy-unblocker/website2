import http from "node:http";
import https from "node:https";
import { appConfig } from "./config.js";
import serveHandler from "serve-handler";

/**
 * @typedef {Object} AppMirror
 * @property {string} prefix
 * @property {string} url
 */

// simple mirror middleware that supports GET/POST
/**
 * @type {import("./mirrors").AppMirror[]}
 */
export const appMirrors = [];

// setup theatre mirror
if (!("theatreFiles" in appConfig))
  appMirrors.push({ prefix: "/cdn/", url: appConfig.theatreFilesMirror });

// setup theatre api mirror
if (!("db" in appConfig))
  appMirrors.push({ prefix: "/api/theatre/", url: appConfig.theatreApiMirror });

const hasTheatreFiles = "theatreFilesPath" in appConfig;

/**
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").OutgoingMessage} res
 * @returns {boolean}
 */
export function handleReq(req, res) {
  const isCDN = req.url.startsWith("/cdn/");

  // THIS SHOULD ALWAYS BE SET ON THEATRE FILES AND /compat/
  // DO NOT DO NOT SET THIS ON /donate/ OR ACCOUNT DETAILS WILL BE LEAKED
  if (isCDN || req.url.startsWith("/compat/")) {
    res.setHeader("cross-origin-resource-policy", "same-origin");
  }

  if (isCDN && hasTheatreFiles) {
    serveHandler(req, res, {
      public: appConfig.theatreFilesPath,
    });
    return false;
  }

  // we want the uv service page to fallback to a page that registers the service worker
  // internal redirect
  if (req.url.startsWith("/uv/service/")) {
    req.url = "/register-uv";
    // app(req, res);
    return true;
  }

  // HIGH PERFORMANCE http proxy
  for (const mirror of appMirrors) {
    if (!req.url.startsWith(mirror.prefix)) continue;

    const sendBody = !["HEAD", "GET"].includes(req.method);
    const mirrorURL = mirror.url + req.url.slice(mirror.prefix.length);

    // console.log("Proxy:", req.url, "->", mirrorURL);

    // make the request
    const mirrorReq = (mirrorURL.startsWith("https:") ? https : http).request(
      mirrorURL,
      {
        method: req.method,
      }
    );

    mirrorReq.on("response", (mirrorRes) => {
      if (mirrorRes.statusCode === 404) {
        req.url = "/404";
        app(req, res);
        return;
      }

      // support redirects
      const loc = mirrorRes.headers["location"];
      if (typeof loc === "string") res.setHeader("location", loc);

      const ce = mirrorRes.headers["content-encoding"];
      if (
        typeof ce === "string" &&
        ["gzip", "compress", "deflate", "br", "zstd"].includes(ce)
      )
        res.setHeader("content-encoding", ce);
      res.writeHead(mirrorRes.statusCode);
      mirrorRes.pipe(res);
    });

    // pipe request body into mirror
    if (sendBody) req.pipe(mirrorReq);
    // or just send the request
    else mirrorReq.end();

    return false;
  }

  return true;
}
