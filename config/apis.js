import pg from "pg";
import nodemailer from "nodemailer";
import { appConfig } from "./config.js";
import { Stripe } from "stripe";
import Dockerode from "dockerode";

export const dbEnabled = "db" in appConfig;
export const stripeEnabled = dbEnabled && "stripe" in appConfig;
export const discordEnabled = stripeEnabled && "discord" in appConfig;
export const discordListening =
  discordEnabled && "listenForJoins" in appConfig.discord;
export const hcaptchaEnabled = stripeEnabled && "hcaptcha" in appConfig;

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

export const docker = stripeEnabled
  ? new Dockerode(appConfig.docker)
  : undefined;

export const mailer = stripeEnabled
  ? nodemailer.createTransport(appConfig.mailer.transport)
  : undefined;

// add some safeguards
if (!stripeEnabled) {
  const traps = {};

  for (const prop of ["stripe", "mailer", "discord"])
    traps[prop] = {
      get: () => {
        throw new TypeError(
          `Tried to get appConfig.${prop}, but stripe support isn't enabled.`
        );
      },
    };

  Object.defineProperties(appConfig, traps);
}

export async function getUserPayment(userId) {
  const payment = (
    await db.query(
      "SELECT * FROM payment WHERE user_id = $1 AND NOW() > period_start AND NOW() < period_end ORDER BY tier DESC;",
      [userId]
    )
  ).rows[0];

  return payment;
}

/**
 * @type {Record<number, string>}
 */
const tierNames = {
  0: "Free",
  1: "Premium Subscriber",
};

/**
 *
 * @param {number} tier
 * @returns {string}
 */
export function getTierName(tier = 0) {
  tier = tier.toString();
  if (!(tier in tierNames)) throw new RangeError(`unknown tier: ${tier}`);
  return tierNames[tier];
}

/**
 *
 * @param {number} tier
 * @returns {string[]}} role ids
 */
function getTierDiscordRoles(tier) {
  const roles = [];
  if (tier >= 1) roles.push(appConfig.discord.roleIds.premium);
  return roles;
}

/**
 *
 * @param {import("@lib/models").UserModel} user
 * @param {number} tier
 * @param {boolean} deleteRoles
 * @returns {boolean}
 */
export async function giveTierDiscordRoles(
  user,
  tier = 0,
  deleteRoles = false
) {
  const roleIds = getTierDiscordRoles(tier);

  for (const roleId of roleIds) {
    console.log(
      deleteRoles ? "Taking" : "Giving",
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
        method: deleteRoles ? "DELETE" : "PUT",
        headers: {
          authorization: `Bot ${appConfig.discord.botToken}`,
          "x-audit-log-reason": `Gave subscriber (id ${
            user.id
          }) this role as part of their tier (${getTierName(tier)})`,
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
