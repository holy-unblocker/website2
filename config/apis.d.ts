import pg from "pg";
import nodemailer from "nodemailer";
import { Stripe } from "stripe";
import * as m from "@lib/models";
import type Dockerode from "dockerode";

/**
 * database
 */
export const dbEnabled: boolean;
/**
 * fiat payment processing
 */
export const stripeEnabled: boolean;
/**
 * crypto payment processing
 */
export const nowpaymentsEnabled: boolean;
/**
 * whether the account system is enabled or not
 */
export const accountsEnabled: boolean;
/**
 * discord bot integration
 */
export const discordEnabled: boolean;
/**
 * whether the client should be signed in and actually do stuff
 */
export const discordListening: boolean;
/**
 * whether hcaptcha challenges should be displayed
 */
export const hcaptchaEnabled: boolean;
/**
 * docker connection
 */
export const docker: Dockerode;
/**
 * postgres connection
 */
export const db: pg.Client;
export const stripe: Stripe;
export const mailer: nodemailer.Transporter;

/**
 * @returns true if it worked, false if the user is not in the configured guild
 */
export async function giveTierDiscordRoles(user: m.UserModel): Promise<boolean>;
