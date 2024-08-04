import pg from "pg";
import nodemailer from "nodemailer";
import { appConfig } from "./config.js";
import { Stripe } from "stripe";
import Dockerode from "dockerode";

export const dbEnabled = "db" in appConfig;
export const stripeEnabled = dbEnabled && "stripe" in appConfig;
export const nowpaymentsEnabled = dbEnabled && "nowpayments" in appConfig;
export const accountsEnabled = stripeEnabled || nowpaymentsEnabled;
export const discordEnabled = accountsEnabled && "discord" in appConfig;
export const discordListening =
  discordEnabled && "listenForJoins" in appConfig.discord;
export const hcaptchaEnabled = accountsEnabled && "hcaptcha" in appConfig;

export const db = await initDB();

/**
 *
 * @returns {Promise<pg.Client>}
 */
async function initDB() {
  if (!dbEnabled) return undefined;

  if (globalThis.hu_db) return globalThis.hu_db;

  const cli = new pg.Client(appConfig.db);

  cli.connect().catch((err) => {
    console.log("failure connecting to db");
    console.error(err);
    process.exit(1);
  });

  globalThis.hu_db = cli;

  return cli;
}

export const stripe = stripeEnabled
  ? new Stripe(appConfig.stripe.secret)
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
      get: () => {
        throw new TypeError(
          `Tried to get appConfig.${prop}, but stripe support isn't enabled.`
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
      appConfig.discord.guildId
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
      }
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
