import pg from "pg";
import nodemailer from "nodemailer";
import { appConfig } from "./config.js";
import { Stripe } from "stripe";
import Dockerode from "dockerode";
import OpenAI from "openai";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const dbEnabled = "db" in appConfig;
export const stripeEnabled = dbEnabled && "stripe" in appConfig;
export const nowpaymentsEnabled = dbEnabled && "nowpayments" in appConfig;
export const accountsEnabled = stripeEnabled || nowpaymentsEnabled;
export const userSystemEnabled = dbEnabled;
export const theatreAdminSignupEnabled =
  dbEnabled && appConfig.theatre.adminSignupEnabled === true;
export const theatrePlayCountingEnabled =
  dbEnabled && appConfig.theatre.playCountingEnabled !== false;
export const discordEnabled = accountsEnabled && "discord" in appConfig;
export const discordListening =
  discordEnabled && "listenForJoins" in appConfig.discord;
export const hcaptchaEnabled = accountsEnabled && "hcaptcha" in appConfig;
export const openaiEnabled = "openai" in appConfig;

// when theatre files are hosted locally, admins can upload/remove thumbnails
export const theatreFilesEnabled = "filesPath" in appConfig.theatre;
// resolved the same way runtime.js does (relative to the project root)
export const theatreFilesPath = theatreFilesEnabled
  ? resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      appConfig.theatre.filesPath,
    )
  : undefined;

export const db = await initDB();

/**
 * A pool, not a single pg.Client: the database is remote (terp.db) since 2026-11-17, and a
 * lone Client whose connection drops emits "error" with no listener, which kills the whole
 * process. The pool discards a broken connection and opens a new one for the next query.
 * There are no multi-statement transactions here, so queries need not share a connection.
 *
 * @returns {Promise<pg.Pool>}
 */
async function initDB() {
  if (!dbEnabled) return undefined;

  if (globalThis.hu_db) return globalThis.hu_db;

  const source = process.env.DATABASE_URL || appConfig.db;
  const pool = new pg.Pool({
    ...(typeof source === "string" ? { connectionString: source } : source),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (err) => {
    console.error(
      "db: idle connection lost, the pool will reconnect:",
      err.message,
    );
  });

  // Fail at startup as before when the database is unreachable or the config is wrong.
  try {
    await pool.query("SELECT 1;");
  } catch (err) {
    console.log("failure connecting to db");
    console.error(err);
    process.exit(1);
  }

  globalThis.hu_db = pool;

  return pool;
}

export const stripe = stripeEnabled
  ? new Stripe(appConfig.stripe.secret)
  : undefined;

export const openai = openaiEnabled
  ? new OpenAI({
      baseURL: appConfig.openai.apiBase,
      apiKey: appConfig.openai.apiKey,
    })
  : undefined;

export const docker = accountsEnabled
  ? new Dockerode(appConfig.docker)
  : undefined;

export const mailer = accountsEnabled
  ? nodemailer.createTransport(appConfig.mailer.transport)
  : undefined;

// add some safeguards
if (!accountsEnabled) {
  const traps = {};

  for (const prop of ["stripe", "docker", "mailer", "discord"])
    traps[prop] = {
      enumerable: false,
      get: () => {
        throw new TypeError(
          `Tried to get appConfig.${prop}, but stripe support isn't enabled.`,
        );
      },
    };

  Object.defineProperties(appConfig, traps);
}

/**
 *
 * @param {import("@lib/models").UserModel} user
 * @param {number} tier
 * @param {boolean} deleteRoles
 * @returns {boolean}
 */
export async function giveTierDiscordRoles(user) {
  const roleIds = [appConfig.discord.roleIds.premium];

  const isPremium = Date.now() < user.paid_until.getTime();

  for (const roleId of roleIds) {
    console.log(
      isPremium ? "Giving" : "Taking",
      "role",
      roleId,
      "to",
      user.discord_id,
      "in guild",
      appConfig.discord.guildId,
    );

    // https://discord.com/developers/docs/resources/guild#add-guild-member-role
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${appConfig.discord.guildId}/members/${user.discord_id}/roles/${roleId}`,
      {
        method: isPremium ? "PUT" : "DELETE",
        headers: {
          authorization: `Bot ${appConfig.discord.botToken}`,
          "x-audit-log-reason": `${
            isPremium ? "Subscribed to" : "Unsubscribed from"
          } premium (${user.id})`,
        },
      },
    );

    if (res.status !== 204) {
      // they probably aren't in the guild
      if (res.status === 404) return false;

      console.error("Error giving user role:", res.status, res.statusText);
      throw new Error(await res.text());
    }
  }

  return true;
}
