// HOLY UNBLOCKER RUNTIME!!

// this code shouldn't be bundled by astro
// vanilla JS = best

// - starts the discord bot (if configured to do so)
//   - checks permissions and verifies everything is OK
// - exports http "request" event handler
// -   sets x-robots-tag
//   - sets cross-origin-resource-policy on /cdn/ and /compat/
//   - sets up mirroring the game cdn, /cdn/
//   - sets up mirroring the theatre API, /api/theatre/
// - exports http "upgrade" event handler
//   - wisp
//   - that's just about it
import http from "node:http";
import https from "node:https";
import { dirname, resolve } from "node:path";
import { access, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import send from "@fastify/send";
import parseUrl from "parseurl";
import { Mrrowisp } from "mrrowisp";
import { ProxyAgent } from "proxy-agent";
import bare from "@tomphttp/bare-server-node";
import { ActivityType, Client, PermissionsBitField } from "discord.js";
import chalk from "chalk";
import compression from "compression";
import {
  getProxyRouteMap,
  proxyRouteCookie,
  rewriteProxyGlobals,
  torCookie,
} from "./src/lib/proxyRoutes.js";

let startupTag = chalk.grey(chalk.bold("Holy Unblocker:"));

// when vite bundles this, it will complain about being unable to import(configFile)
// however, this is annoying and stupid
// import.meta.url is very reliable for this!!
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configFile = resolve(__dirname, "./config/config.js");
try {
  await access(configFile);
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  console.log(startupTag, chalk.yellow("No config.js file found. Making one."));
  copyFile("./config/config.example.js", "./config/config.js");
  console.log(
    startupTag,
    chalk.italic("copying config.example.js -> config.js"),
  );
}

/**
 * @type {import("./config/config").AppConfig}
 */
let appConfig;

try {
  appConfig = (await import("./config/config.js")).appConfig;
} catch (err) {
  // user config error
  console.error(
    chalk.bold("An error occurred while trying to load ./config/config.js!"),
  );
  console.error(err);
  console.error(
    chalk.grey.italic(
      "This error was likely caused as a result of you changing something.",
    ),
  );
  console.error(chalk.grey.italic("Please check your config then try again!"));
  process.exit(1);
}

const { db, giveTierDiscordRoles, accountsEnabled } =
  await import("./config/apis.js");

// check runtime requirements
// in both astro dev server & runtime

const majorNodeVersion = Number(process.versions.node.split(".")[0]);

if (majorNodeVersion < 19) {
  console.error("Your NodeJS version is unsupported!");
  console.error("You need at least NodeJS v19 to run Holy Unblocker");
  console.error(
    "You can fix this by upgrading NodeJS. Try installing nvm: https://github.com/nvm-sh/nvm",
  );
  process.exit(1);
}

const client = new Client({ intents: [] });

client.on("ready", async () => {
  console.log(`${chalk.bold("Discord:")} Logged in as ${client.user.tag}!`);

  const rolesRes = await fetch(
    `https://discord.com/api/v10/guilds/${appConfig.discord.guildId}/roles`,
    {
      headers: {
        authorization: `Bot ${appConfig.discord.botToken}`,
      },
    },
  );

  if (rolesRes.status !== 200) {
    console.error(
      "Error fetching roles for guild:",
      appConfig.discord.guildId,
      rolesRes.status,
    );
    console.error(await rolesRes.text());
    if (rolesRes.status === 404) {
      console.log(
        "Make sure you invited the bot to your server! Or that the guild ID is correct",
      );
      console.log("Use this link to invite the bot:");
      // we need MANAGE_ROLES to assign ppl their roles
      // this link should have that permission set
      console.log(
        `https://discord.com/oauth2/authorize?client_id=${appConfig.discord.clientId}&scope=bot&permissions=268435456`,
      );
      process.exit(1);
    }
  }

  const serverRoles = await rolesRes.json();

  const clientMember = await (
    await fetch(
      `https://discord.com/api/v10/guilds/${appConfig.discord.guildId}/members/${appConfig.discord.clientId}`,
      {
        headers: {
          authorization: `Bot ${appConfig.discord.botToken}`,
        },
      },
    )
  ).json();

  if (clientMember.roles.length === 0) {
    console.error(
      "In order to give users their subscription roles, the discord bot needs a role with Manage Roles.",
    );
    console.error(
      "You need to create a role, move it above the subscriber roles, and assign it to the Discord bot.",
    );
    process.exit(1);
  }

  // check if we can manage roles
  const canManageRoles = clientMember.roles.some((role) =>
    new PermissionsBitField(
      serverRoles.find((e) => e.id === role).permissions,
    ).has("ManageRoles"),
  );

  if (!canManageRoles) {
    console.error(
      "In order to give users their subscription roles, the Discord bot needs the Manage Roles permission.",
    );
    console.error("You need to give the Discord bot a role with permission.");
    process.exit(1);
  }

  const highestRoleId = clientMember.roles[clientMember.roles.length - 1];
  const highestRole = serverRoles.find((e) => e.id === highestRoleId);

  for (const tier in appConfig.discord.roleIds) {
    const id = appConfig.discord.roleIds[tier];
    const role = serverRoles.find((r) => r.id === id);
    if (role === undefined) {
      console.error("Invalid role id", id, "for tier", tier);
      process.exit(1);
    }
    if (role.position > highestRole.position) {
      console.error("Cannot give users the role", role.name);
      console.error(
        "You need to give the Discord bot a role that's higher than",
        role.name,
      );
      process.exit();
    }
  }

  console.log(chalk.bold("Discord bot permissions look good."));

  client.user.setPresence({
    status: "dnd",
    activities: [
      {
        name: "for new members",
        state: "",
        url: appConfig.mainWebsite,
        type: ActivityType.Watching,
      },
    ],
  });

  // process.exit(1);
});

client.on("guildMemberAdd", async (member) => {
  console.log("Member", member.id, "just joined guild", member.guild.id);
  if (member.guild.id !== appConfig.discord.guildId) {
    console.log("Guild isn't part of config, ignoring!");
    return;
  }

  /**
   * @type {import("@lib/util").m.UserModel}
   */
  const user = (
    await db.query("SELECT * FROM users WHERE discord_id = $1;", [
      member.user.id,
    ])
  ).rows[0];

  if (user) {
    console.log("Found user:", user);
    await giveTierDiscordRoles(user);
  }
});

// start the discord bot here
if (accountsEnabled && appConfig.discord.listenForJoins)
  client.login(appConfig.discord.botToken);

function getCookie(req, name) {
  const cookie = req.headers.cookie;
  if (typeof cookie !== "string") return;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
}

/**
 * @typedef {Object} AppMirror
 * @property {string} prefix
 * @property {string} url
 */

// simple mirror middleware that supports GET/POST

const hasTheatreFiles = "filesPath" in appConfig.theatre;

const cdnAbs =
  hasTheatreFiles && resolve(__dirname, appConfig.theatre.filesPath);

/**
 * @type {AppMirror[]}
 */
const appMirrors = [];

// setup theatre mirror
if (!hasTheatreFiles)
  appMirrors.push({ prefix: "/cdn/", url: appConfig.theatre.filesMirror });

// setup theatre api mirror
if (!("db" in appConfig))
  appMirrors.push({
    prefix: "/api/theatre/",
    url: appConfig.theatre.apiMirror,
  });

const compress = compression();

// when configured, route all locally-hosted proxy traffic through an upstream
// proxy. ProxyAgent picks the right transport (http/https/socks) from the URL.
const hasProxyServer = "proxyServer" in appConfig;
const proxyAgent = hasProxyServer
  ? new ProxyAgent({ getProxyForUrl: () => appConfig.proxyServer })
  : undefined;

// when a tor proxy is configured we host a SECOND bare server and a SECOND
// wisp instance that route through tor. clients opt in with the tor cookie.
const hasTorProxy = "torProxy" in appConfig;
const torAgent = hasTorProxy
  ? new ProxyAgent({ getProxyForUrl: () => appConfig.torProxy })
  : undefined;

const hostBare = !("separateBareServer" in appConfig);
const hostWisp = !("separateWispServer" in appConfig);

/**
 * @param {ProxyAgent | undefined} agent
 */
function createBare(agent) {
  return bare.createBareServer(
    "/api/bare/",
    agent ? { httpAgent: agent, httpsAgent: agent } : undefined,
  );
}

const bareServer = createBare(proxyAgent);
// tor-routed bare server (only created when torProxy is configured)
const torBareServer = hasTorProxy ? createBare(torAgent) : undefined;

const wispServerLogging = false;

/**
 * @param {string | undefined} proxy
 */
async function createWisp(proxy) {
  const server = new Mrrowisp({
    logLevel: wispServerLogging ? "debug" : "none",
    allowUDP: false,
    ...(proxy ? { proxy } : {}),
  });
  await server.start();
  return server;
}

/**
 * @type {Mrrowisp | undefined}
 */
let wisp;
/**
 * tor-routed wisp instance (only created when torProxy is configured)
 * @type {Mrrowisp | undefined}
 */
let torWisp;
if (hostWisp) {
  wisp = await createWisp(hasProxyServer ? appConfig.proxyServer : undefined);
  if (hasTorProxy) torWisp = await createWisp(appConfig.torProxy);
}

/**
 * picks the tor or normal variant of a server based on the client's tor cookie.
 * @template T
 * @param {import("http").IncomingMessage} req
 * @param {T} normal
 * @param {T | undefined} tor
 * @returns {T}
 */
function pickByTor(req, normal, tor) {
  if (tor && getCookie(req, torCookie) === "1") return tor;
  return normal;
}

const javascriptType =
  /(?:^|;)\s*(?:application|text)\/(?:javascript|ecmascript|x-javascript|javascript1\.[0-9])\b|(?:^|;)\s*application\/(?:x-)?(?:java|ecma)script\b/i;
const htmlType = /(?:^|;)\s*(?:text\/html|application\/xhtml\+xml)\b/i;

function headerValue(headers, name) {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(", ") : value;
}

function shouldRewriteJavascript(headers) {
  const contentType = headerValue(headers, "content-type");
  const contentEncoding = headerValue(headers, "content-encoding");
  return (
    typeof contentType === "string" &&
    javascriptType.test(contentType) &&
    (contentEncoding === undefined || contentEncoding === "identity")
  );
}

function shouldSpoofHtmlStatus(req, headers, statusCode) {
  const contentType = headerValue(headers, "content-type");
  return (
    statusCode === 404 &&
    typeof contentType === "string" &&
    htmlType.test(contentType) &&
    req.url.startsWith("/_astro/")
  );
}

function normalizeWriteHeadArgs(statusCode, statusMessage, headers) {
  if (typeof statusMessage === "object" && statusMessage !== null) {
    return { statusCode, statusMessage: undefined, headers: statusMessage };
  }
  return { statusCode, statusMessage, headers };
}

function installProxyResponseHook(req, res, routes) {
  const write = res.write.bind(res);
  const end = res.end.bind(res);
  const writeHead = res.writeHead.bind(res);
  let buffering = false;
  let headWritten = false;
  const chunks = [];

  function appendChunk(chunk, encoding) {
    if (!chunk) return;
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === "string")
      chunks.push(Buffer.from(chunk, encoding));
    else chunks.push(Buffer.from(chunk));
  }

  function writeCallback(encoding, callback) {
    if (typeof callback === "function") return callback;
    if (typeof encoding === "function") return encoding;
  }

  res.writeHead = (statusCode, statusMessage, headers) => {
    const normalized = normalizeWriteHeadArgs(
      statusCode,
      statusMessage,
      headers,
    );
    if (normalized.headers) {
      for (const [name, value] of Object.entries(normalized.headers)) {
        res.setHeader(name, value);
      }
    }

    const outgoingHeaders = res.getHeaders();
    buffering = shouldRewriteJavascript(outgoingHeaders);
    if (shouldSpoofHtmlStatus(req, outgoingHeaders, normalized.statusCode)) {
      normalized.statusCode = 200;
      normalized.statusMessage = "OK";
    }

    if (buffering) return res;

    headWritten = true;
    if (typeof normalized.statusMessage === "string") {
      return writeHead(normalized.statusCode, normalized.statusMessage);
    }
    return writeHead(normalized.statusCode);
  };

  res.write = (chunk, encoding, callback) => {
    if (buffering) {
      appendChunk(chunk, typeof encoding === "string" ? encoding : undefined);
      const done = writeCallback(encoding, callback);
      if (done) process.nextTick(done);
      return true;
    }
    return write(chunk, encoding, callback);
  };

  res.end = (chunk, encoding, callback) => {
    if (!buffering) return end(chunk, encoding, callback);

    appendChunk(chunk, typeof encoding === "string" ? encoding : undefined);

    const source = Buffer.concat(chunks).toString("utf-8");
    const rewritten = rewriteProxyGlobals(source, routes);
    const done = writeCallback(encoding, callback);
    res.removeHeader("content-length");
    res.removeHeader("etag");
    res.removeHeader("content-md5");
    res.removeHeader("digest");

    if (!headWritten) writeHead(res.statusCode, res.statusMessage);
    return end(rewritten, "utf-8", done);
  };
}

/**
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").OutgoingMessage} res
 * @param {() => void} middleware
 */
export function handleReq(req, res, middleware) {
  if (hostBare && bareServer.shouldRoute(req)) {
    pickByTor(req, bareServer, torBareServer).routeRequest(req, res);
    return;
  }

  const proxyRoutes = getProxyRouteMap(getCookie(req, proxyRouteCookie));
  // strip client encoding negotiation so upstream (Vite in dev, compression in
  // prod) serves identity-encoded JS the rewrite hook can buffer and patch.
  // we re-compress ourselves below via compress().
  delete req.headers["accept-encoding"];
  installProxyResponseHook(req, res, proxyRoutes);

  // hooks the res
  compress(req, res, () => {});

  const isCDN = req.url.startsWith("/cdn/");

  // THIS SHOULD ALWAYS BE SET ON THEATRE FILES AND /compat/
  // DO NOT DO NOT SET THIS ON /pro/ OR ACCOUNT DETAILS WILL BE LEAKED
  // if (isCDN || req.url.startsWith("/compat/")) {
  if (!req.url.startsWith("/pro")) {
    // enable cross-origin isolation (crossOriginIsolated === true)
    // this makes loading epoxy TLS faster and unlocks SharedArrayBuffer
    // thanks r58
    res.setHeader("cross-origin-opener-policy", "same-origin");
    res.setHeader("cross-origin-embedder-policy", "credentialless");
    res.setHeader("cross-origin-resource-policy", "same-origin");
  }

  const isMainWebsite =
    !("mainWebsite" in appConfig) || req.headers.host === appConfig.mainWebsite;

  // prevent scraping of website
  if (!isMainWebsite) {
    res.setHeader("x-robots-tag", "noindex");
    if (req.url.startsWith("/sitemap")) {
      req.url = "/404";
      return middleware();
    }
  }

  // docs: https://github.com/vercel/serve-handler
  if (isCDN && hasTheatreFiles) {
    // docs: https://www.npmjs.com/package/@fastify/send
    req.url = req.url.slice("/cdn".length);
    send(req, parseUrl(req).pathname, {
      root: cdnAbs,
    }).then(({ statusCode, headers, stream }) => {
      if (statusCode === 404) {
        // internal redirect to 404 page
        req.url = "/404";
        middleware(req, res);
      } else {
        // normalize the url
        if ("Location" in headers) headers.Location = "/cdn" + headers.Location;
        // write the head before piping so redirect status/headers aren't lost
        res.writeHead(statusCode, headers);
        stream.pipe(res);
      }
    });
    return;
  }

  // we want the service pages to fallback to a page that registers the service worker
  // internal redirect so the browser URL stays the seeded service URL, while we
  // render the seeded register route (never the fixed /register-* path)
  if (req.url.startsWith(proxyRoutes.uvConfig.prefix)) {
    req.url = proxyRoutes.paths.registerUV;
    return middleware();
  }
  if (req.url.startsWith(proxyRoutes.sjConfig.prefix)) {
    req.url = proxyRoutes.paths.registerScramjet;
    return middleware();
  }

  // MIRRORS HTTP PROXDY
  for (const mirror of appMirrors) {
    if (!req.url.startsWith(mirror.prefix)) continue;

    const sendBody = !["HEAD", "GET"].includes(req.method);
    const mirrorURL = mirror.url + req.url.slice(mirror.prefix.length);

    // console.log("Proxy:", req.url, "->", mirrorURL);

    /**
     * @type {Record<string, string>}
     */
    const mirrorHeaders = {};

    const ct = req.headers["content-type"];
    if (typeof ct === "string") mirrorHeaders["content-type"] = ct;

    // make the request
    const mirrorReq = (mirrorURL.startsWith("https:") ? https : http).request(
      mirrorURL,
      {
        method: req.method,
        headers: mirrorHeaders,
      },
    );

    mirrorReq.on("error", (err) => {
      console.error("error when loading proxy", mirrorURL);
      console.error(err);
      res.writeHead(502);
      res.end();
    });

    mirrorReq.on("response", (mirrorRes) => {
      if (mirrorRes.statusCode === 404) {
        // display astro 404 page
        req.url = "/404";
        return middleware();
      }

      // support redirects
      const loc = mirrorRes.headers["location"];
      if (typeof loc === "string") {
        // the upstream Location is relative to the mirror's own URL, so a bare
        // redirect (eg. adding a trailing slash to a directory) would escape
        // the local mirror prefix and 404 against astro. resolve it against the
        // upstream URL and, if it still points inside the mirror, map it back
        // under the local prefix (eg. /cdn/).
        let normalizedLoc = loc;
        try {
          const resolved = new URL(loc, mirrorURL);
          const base = new URL(mirror.url);
          if (
            resolved.origin === base.origin &&
            resolved.pathname.startsWith(base.pathname)
          ) {
            normalizedLoc =
              mirror.prefix +
              resolved.pathname.slice(base.pathname.length) +
              resolved.search +
              resolved.hash;
          }
        } catch {
          // leave the location untouched if it can't be parsed
        }
        res.setHeader("location", normalizedLoc);
      }

      const ct = mirrorRes.headers["content-type"];
      if (typeof ct === "string") res.setHeader("content-type", ct);

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

    return;
  }

  return middleware();
}

// handle 'upgrade' event on http server
// the url / is reserved for astro dev server HMR

export function handleUpgrade(req, socket, head) {
  if (hostBare && bareServer.shouldRoute(req)) {
    pickByTor(req, bareServer, torBareServer).routeUpgrade(req, socket, head);
    return;
  }

  if (hostWisp && req.url === "/api/wisp/") {
    pickByTor(req, wisp, torWisp).route(req, socket, head);
    return;
  }

  console.log("bad websocket req @", req.url);
  // kill the request so it isn't stuck loading
  socket.end();
}

console.log(startupTag, "Runtime loaded");
