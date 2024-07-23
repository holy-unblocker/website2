import pg from "pg";
import nodemailer from "nodemailer";
import { Stripe } from "stripe";
import * as m from "@lib/models";

/**
 * database
 */
export const dbEnabled: boolean;
/**
 * payment processing/accounts
 * basically whether the account system is enabled or not
 */
export const stripeEnabled: boolean;
/**
 * discord bot integration
 */
export const discordEnabled: boolean;
/**
 * whether the client should be signed in and actually do stuff
 */
export const discordListening: boolean;
/**
 * postgres instance
 */
export const db: pg.Client;
export const stripe: Stripe;
export const mailer: nodemailer.Transporter;

// we also store some functions for user management
// for discord stuff

// returns undefined = no current payment plan
export async function getUserPayment(
  userId: number,
): Promise<m.PaymentModel | undefined>;

/**
 * Returns the full name for a payment tier
 * Defaults to free tier
 */
export function getTierName(tier: number = 0): string;

/**
 * @param user
 * @param tier
 * @param deleteRoles whether to delete the roles instead of giving them
 * @returns true if it worked, false if the user is not in the configured guild
 */
export async function giveTierDiscordRoles(
  user: m.UserModel,
  tier: number = 0,
  deleteRoles: boolean = false,
): Promise<boolean>;
