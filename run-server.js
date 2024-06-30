import serveHandler from "serve-handler";
import wisp from "wisp-server-node";
import http from "node:http";
import chalk from "chalk";
import { readFile } from "node:fs/promises";

const logoBg = chalk.bgBlueBright;
const block = logoBg.blueBright.bold;

console.log(block("███████████████████████████"));
console.log(
  block("██") + logoBg.black("Holy Unblocker Frontend") + block("██")
);
console.log(block("███████████████████████████"));
console.log(chalk.italic(`Logs start ${new Date().toTimeString()}`));

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

const yes = chalk.green("✓"); // Check mark
const no = chalk.red("✗"); // Ballot X
const st = [no, yes];

/**
 * @type {typeof import("./dist/server/entry.mjs")['handler']}
 */
let astroMiddleware;

try {
  astroMiddleware = (await import("./dist/server/entry.mjs")).handler;
} catch (err) {
  console.error(err);
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.log(
      no,
      chalk.bold("ERROR:"),
      "You haven't built Holy Unblocker yet, so you can't start the frontend yet."
    );
    console.log(
      "To fix this error, run `npm run build` first, and then run `npm start`"
    );
  }
  process.exit(1);
}
console.log(yes, chalk.red.bold("Loaded Astro"));

// we have to dynamically import it because it's dynamically created when `npm run build` is ran
const { appConfig } = await import("./config/config.js");

// same principle
const { handleReq } = await import("./config/mirrors.js");

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

const hasDB = "db" in appConfig;
const hasDiscord = "discord" in appConfig;
const hasTheatreFiles = "theatreFilesPath" in appConfig;
const hasMailer = "mailer" in appConfig;
const hasStripe = "stripe" in appConfig;
const separateWisp = "separateWispServer" in appConfig;

console.log(st[+hasDB], chalk.bold("Postgres credentials"));
if (!hasDB) {
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

console.log(st[+!separateWisp], chalk.bold("Wisp server"));

if (separateWisp)
  console.log(
    ` - ${yes} Using separate wisp server: ${appConfig.separateWispServer}`
  );

console.log(st[+hasStripe], chalk.bold("Stripe payment processing"));
console.log(
  ` - ${st[+hasStripe]} Account system`,
  ["disabled", "enabled"][+hasStripe]
);

if (hasStripe) {
  console.log(st[+hasMailer], chalk.bold("Mailer"));
  if (!hasMailer) {
    console.error("You need to configure your mailer.");
    process.exit(1);
  }

  console.log(st[+hasDiscord], chalk.bold("Discord integration"));
  if (!hasMailer) {
    console.error("You need to configure your discord integration.");
    process.exit(1);
  }
}

if (!("links" in appConfig)) {
  console.log("Missing 'links', invalid config");
  process.exit(1);
}

console.log(chalk.italic("Configuration is valid."));

// let astro render 404 and every route by not passing it the `next` argument

const server = http.createServer();

server.on("request", (req, res) => {
  if (handleReq(req, res)) {
    astroMiddleware(req, res, () => {
      serveHandler(
        req,
        res,
        {
          public: "dist/client/",
        },
        {
          sendError() {
            // display astro 404 page
            req.url = "/404";
            astroMiddleware(req, res);
          },
        }
      );
    });
  }
});

server.on("upgrade", (req, socket, head) => {
  if (!separateWisp && req.url.startsWith("/wisp/"))
    wisp.routeRequest(req, socket, head);
  else socket.end();
});

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
