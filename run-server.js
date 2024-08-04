// HOLY UNBLOCKER FRONTEND!!
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// dynamically import all external modules
// we want to display a custom error for when node modules r missing

/**
 * @type {typeof import("@fastify/send")}
 */
let send;

try {
  send = (await import("@fastify/send")).default;
} catch (err) {
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.log(
      "ERROR: You haven't installed dependencies for Holy Unblocker yet, so you can't start the frontend yet."
    );
    console.log(
      "To fix this error, run `npm install` first, and then run `npm start`"
    );
    process.exit(1);
  } else throw err; // WUT
}

const parseUrl = (await import("parseurl")).default;
const chalk = (await import("chalk")).default;

const yes = chalk.green("✓"); // Check mark
const no = chalk.red("✗"); // Ballot X
const st = [no, yes];

const logoBg = chalk.bgBlueBright;
const block = logoBg.blueBright.bold;

console.log(block("███████████████████████████"));
console.log(
  block("██") + logoBg.black("Holy Unblocker Frontend") + block("██")
);
console.log(block("███████████████████████████"));
console.log(chalk.italic(`Logs start ${new Date().toTimeString()}`));

// we have to dynamically import it because it's dynamically created when `npm run build` is ran
const { handleReq, handleUpgrade } = await import("./runtime.js");
const apis = await import("./config/apis.js");
const { appConfig } = await import("./config/config.js");

// display package versions
const pkg = JSON.parse(
  await readFile(new URL("./package-lock.json", import.meta.url), "utf-8")
);

console.log(chalk.bold("Version:"), pkg.version);

console.log(chalk.bold("Dependencies:"));

for (const dep of [
  "@ruffle-rs/ruffle",
  "@mercuryworkshop/bare-mux",
  "@mercuryworkshop/epoxy-transport",
  "@titaniumnetwork-dev/ultraviolet",
  "wisp-server-node",
])
  console.log(
    " - " +
      chalk.bold(dep) +
      ": v" +
      pkg.packages["node_modules/" + dep].version
  );

/**
 * @type {typeof import("./dist/server/entry.mjs")['handler']}
 */
let astroMiddleware;

const astroMiddlewareFile = new URL("./dist/server/entry.mjs", import.meta.url);

try {
  astroMiddleware = (await import(astroMiddlewareFile)).handler;
} catch (err) {
  if (
    err?.code === "ERR_MODULE_NOT_FOUND" &&
    err.url === astroMiddlewareFile.toString()
  ) {
    console.log(
      no,
      chalk.bold("ERROR:"),
      "You haven't built Holy Unblocker yet, so you can't start the frontend yet."
    );
    console.log(
      "To fix this error, run `npm run build` first, and then run `npm start`"
    );
    process.exit(1);
  } else throw err; // wut
}

console.log(yes, chalk.red.bold("Loaded Astro"));

if (!("configName" in appConfig)) {
  console.log("Missing 'configName', invalid config");
  process.exit(1);
}

console.log(
  yes,
  chalk.bold("Loaded config"),
  chalk.italic(chalk.underline(appConfig.configName))
);

console.log(chalk.italic("Checking config..."));

console.log(st[+apis.dbEnabled], chalk.bold("Postgres credentials"));
if (!apis.dbEnabled) {
  console.log(` - ${no} no database credentials found`);

  console.log(` - ${yes} proxying API requests to`, appConfig.theatreApiMirror);

  try {
    new URL(appConfig.theatreApiMirror);
  } catch (err) {
    console.log("Invalid mirror URL", appConfig.theatreApiMirror);
    process.exit(1);
  }

  console.log(
    chalk.grey(
      " - this api basically provides information about the entire game library"
    )
  );
  console.log(chalk.grey("    and it uses postgres"));
}

const hasTheatreFiles = "theatreFilesPath" in appConfig;
console.log(st[+hasTheatreFiles], chalk.bold("Theatre files"));
if (!hasTheatreFiles) {
  console.log(
    ` - ${yes} proxying theatre files to`,
    appConfig.theatreFilesMirror
  );

  try {
    new URL(appConfig.theatreFilesMirror);
  } catch (err) {
    console.log("Invalid mirror URL", appConfig.theatreFilesMirror);
    process.exit(1);
  }

  console.log(
    " - " +
      chalk.grey("btw theatre files include the entire Holy Unblocker Arcade")
  );
  console.log(
    chalk.grey(
      "   which is pretty massive and u might not want to host it, idk"
    )
  );
}

const separateWisp = "separateWispServer" in appConfig;
console.log(st[+!separateWisp], chalk.bold("Wisp server"));

if (separateWisp)
  console.log(
    ` - ${yes} Using separate wisp server: ${appConfig.separateWispServer}`
  );

console.log(st[+apis.accountsEnabled], chalk.bold("Account system"));
console.log(
  ` - ${st[+apis.stripeEnabled]} Stripe payment processing`,
  ["disabled", "enabled"][+apis.stripeEnabled]
);
console.log(
  ` - ${st[+apis.nowpaymentsEnabled]} NOWPayments payment processing`,
  ["disabled", "enabled"][+apis.nowpaymentsEnabled]
);

if (apis.discordEnabled) {
  const hasMailer = "mailer" in appConfig;
  console.log(st[+hasMailer], chalk.bold("Mailer"));
  if (!hasMailer) {
    console.error("You need to configure your mailer.");
    process.exit(1);
  }

  console.log(st[+apis.discordEnabled], chalk.bold("Discord integration"));
  if (!apis.discordEnabled) {
    console.error("You need to configure your discord integration.");
    process.exit(1);
  }

  console.log(st[+apis.discordListening], chalk.bold("Discord bot running"));
  console.log(
    "   " +
      chalk.grey("you can turn this off by setting listenForJoins to false")
  );
  console.log(
    chalk.grey(
      "   you should probably do it if you're actively updating HU's server"
    )
  );
}

if (!("links" in appConfig)) {
  console.log("Missing 'links', invalid config");
  process.exit(1);
}

console.log(chalk.italic("Configuration is valid."));

// let astro render 404 and every route by not passing it the `next` argument

const server = http.createServer();

const clientDir = fileURLToPath(new URL("./dist/client/", import.meta.url));

server.on("request", (req, res) => {
  handleReq(req, res, () => {
    astroMiddleware(req, res, () => {
      // docs: https://www.npmjs.com/package/@fastify/send
      send(req, parseUrl(req).pathname, { root: clientDir }).then(
        ({ statusCode, headers, stream }) => {
          if (statusCode === 404) {
            // internal redirect to 404 page
            req.url = "/404";
            astroMiddleware(req, res);
          } else {
            res.writeHead(statusCode, headers);
            stream.pipe(res);
          }
        }
      );
    });
  });
});

server.on("upgrade", handleUpgrade);

server.on("listening", () => {
  console.log(
    chalk.italic(
      `Frontend listening on http://${appConfig.host}:${appConfig.port}/`
    )
  );
  console.log(yes, chalk.bold("Holy Unblocker is running"));
});

server.listen({
  port: appConfig.port,
  host: appConfig.host,
});
