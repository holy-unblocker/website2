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
import { access, copyFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import send from "@fastify/send";
import parseUrl from "parseurl";
import wisp from "wisp-server-node";
import { ActivityType, Client, PermissionsBitField } from "discord.js";
import chalk from "chalk";
import compression from "compression";

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
    chalk.italic("copying config.example.js -> config.js")
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
    chalk.bold("An error occurred while trying to load ./config/config.js!")
  );
  console.error(err);
  console.error(
    chalk.grey.italic(
      "This error was likely caused as a result of you changing something."
    )
  );
  console.error(chalk.grey.italic("Please check your config then try again!"));
  process.exit(1);
}

const { db, giveTierDiscordRoles, accountsEnabled } = await import(
  "./config/apis.js"
);

// check runtime requirements
// in both astro dev server & runtime

const majorNodeVersion = Number(process.versions.node.split(".")[0]);

if (majorNodeVersion < 19) {
  console.error("Your NodeJS version is unsupported!");
  console.error("You need at least NodeJS v19 to run Holy Unblocker");
  console.error(
    "You can fix this by upgrading NodeJS. Try installing nvm: https://github.com/nvm-sh/nvm"
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
    }
  );

  if (rolesRes.status !== 200) {
    console.error(
      "Error fetching roles for guild:",
      appConfig.discord.guildId,
      rolesRes.status
    );
    console.error(await rolesRes.text());
    if (rolesRes.status === 404) {
      console.log(
        "Make sure you invited the bot to your server! Or that the guild ID is correct"
      );
      console.log("Use this link to invite the bot:");
      // we need MANAGE_ROLES to assign ppl their roles
      // this link should have that permission set
      console.log(
        `https://discord.com/oauth2/authorize?client_id=${appConfig.discord.clientId}&scope=bot&permissions=268435456`
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
      }
    )
  ).json();

  if (clientMember.roles.length === 0) {
    console.error(
      "In order to give users their subscription roles, the discord bot needs a role with Manage Roles."
    );
    console.error(
      "You need to create a role, move it above the subscriber roles, and assign it to the Discord bot."
    );
    process.exit(1);
  }

  // check if we can manage roles
  const canManageRoles = clientMember.roles.some((role) =>
    new PermissionsBitField(
      serverRoles.find((e) => e.id === role).permissions
    ).has("ManageRoles")
  );

  if (!canManageRoles) {
    console.error(
      "In order to give users their subscription roles, the Discord bot needs the Manage Roles permission."
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
        role.name
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

/**
 *
 * cursed ultraviolet config loader
 * configs can be location-aware
 * @param {string} host
 * @param {string} url
 * @returns {import("@titaniumnetwork-dev/ultraviolet").UVConfig}
 */
function getUVConfig(host, url) {
  const mockEnv = {
    Ultraviolet: {
      codec: { xor: {} },
    },
    location: new URL(`http://${host}${url}`),
  };
  mockEnv.self = mockEnv;
  new Function(...Object.keys(mockEnv), uvConfigSrc)(...Object.values(mockEnv));
  // console.log(mockEnv);
  return mockEnv.__uv$config;
}

/**
 * @typedef {Object} AppMirror
 * @property {string} prefix
 * @property {string} url
 */

// simple mirror middleware that supports GET/POST

const hasTheatreFiles = "theatreFilesPath" in appConfig;

const cdnAbs =
  hasTheatreFiles && resolve(__dirname, appConfig.theatreFilesPath);

/**
 * @type {AppMirror[]}
 */
const appMirrors = [];

// setup theatre mirror
if (!hasTheatreFiles)
  appMirrors.push({ prefix: "/cdn/", url: appConfig.theatreFilesMirror });

// setup theatre api mirror
if (!("db" in appConfig))
  appMirrors.push({ prefix: "/api/theatre/", url: appConfig.theatreApiMirror });

// now we can use self.__uv$config in the backend
// this is kinda cursed
const uvConfigSrc = await readFile(
  new URL("./public/uv/uv.config.js", import.meta.url),
  "utf-8"
);

const compress = compression();

/**
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").OutgoingMessage} res
 * @param {() => void} middleware
 */
export function handleReq(req, res, middleware) {
  // hooks the res
  compress(req, res, () => {});

  const isCDN = req.url.startsWith("/cdn/");

  // THIS SHOULD ALWAYS BE SET ON THEATRE FILES AND /compat/
  // DO NOT DO NOT SET THIS ON /pro/ OR ACCOUNT DETAILS WILL BE LEAKED
  // if (isCDN || req.url.startsWith("/compat/")) {
  if (!req.url.startsWith("/pro")) {
    // this makes loading epoxy TLS faster
    // thanks r58
    res.setHeader(
      "cross-origin-opener-policy-report-only",
      "same-origin-allow-popups"
    );
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
        stream.pipe(res);
        res.writeHead(statusCode, headers);
      }
    });
    return;
  }

  const __uv$config = getUVConfig(req.headers.host, req.url);
  // console.log("got config", __uv$config);

  // we want the uv service page to fallback to a page that registers the service worker
  // internal redirect
  if (req.url.startsWith(__uv$config.prefix)) {
    req.url = "/register-uv";
    // app(req, res);
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
      }
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
      if (typeof loc === "string") res.setHeader("location", loc);

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

const wispServerLogging = false;

export function handleUpgrade(req, socket, head) {
  if (req.url === "/api/wisp/" && !("separateWispServer" in appConfig)) {
    wisp.routeRequest(req, socket, head, { logging: wispServerLogging });
  } else {
    console.log("bad websocket req @", req.url);
    // kill the request so it isn't stuck loading
    socket.end();
  }
}

console.log(startupTag, "Runtime loaded");
