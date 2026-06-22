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
 * whether database-backed login/session support is enabled
 */
export const userSystemEnabled: boolean;
/**
 * whether the first theatre admin can be created from /admin/signup
 */
export const theatreAdminSignupEnabled: boolean;
/**
 * whether opening theatre games increments their play counts
 */
export const theatrePlayCountingEnabled: boolean;
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
 * whether theatre files (eg. thumbnails) are hosted locally and writable
 */
export const theatreFilesEnabled: boolean;
/**
 * absolute path to the locally-hosted theatre files, if configured
 */
export const theatreFilesPath: string | undefined;
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
