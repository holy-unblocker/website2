import pg from "pg";
import nodemailer from "nodemailer";
import { appConfig } from "./config.js";
import { Stripe } from "stripe";

export const dbEnabled = "db" in appConfig;
export const stripeEnabled = dbEnabled && "stripe" in appConfig;
export const discordEnabled = stripeEnabled && "discord" in appConfig;
export const discordListening =
  discordEnabled && "listenForJoins" in appConfig.discord;

export const db = await initDB();

async function initDB() {
  if (!dbEnabled) return undefined;

  const cli = new pg.Client(appConfig.db);

  cli.connect().catch((err) => {
    console.log("failure connecting to db");
    console.error(err);
    process.exit(1);
  });

  return cli;
}

export const stripe = stripeEnabled
  ? new Stripe(appConfig.stripe.secret)
  : undefined;

export const mailer = stripeEnabled
  ? nodemailer.createTransport(appConfig.mailer.transport)
  : undefined;

// add some safeguards
if (!stripeEnabled)
  Object.defineProperties(appConfig, {
    stripe: {
      get: () => {
        throw new TypeError(
          "Tried to get appConfig.stripe, but stripe support isn't enabled.",
        );
      },
    },
    mailer: {
      get: () => {
        throw new TypeError(
          "Tried to get appConfig.mailer, but stripe support isn't enabled.",
        );
      },
    },
    discord: {
      get: () => {
        throw new TypeError(
          "Tried to get appConfig.discord, but stripe support isn't enabled.",
        );
      },
    },
  });

export async function getUserPayment(userId) {
  const payment = (
    await db.query(
      "SELECT * FROM payment WHERE user_id = $1 AND NOW() > period_start AND NOW() < period_end ORDER BY tier DESC;",
      [userId],
    )
  ).rows[0];

  return payment;
}

/**
 * @type {Record<number, string>}
 */
const tierNames = {
  0: "Free",
  1: "Official Subscriber",
  2: "Ultimate Subscriber",
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
  if (tier >= 1) roles.push(appConfig.discord.roleIds.official);
  if (tier >= 2) roles.push(appConfig.discord.roleIds.ultimate);
  if (tier >= 3) roles.push(appConfig.discord.roleIds.meal);
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
  deleteRoles = false,
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
      appConfig.discord.guildId,
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
