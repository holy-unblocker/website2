import { db, nowpaymentsEnabled, stripe, stripeEnabled } from "@config/apis";
import { randomBytes } from "node:crypto";
import { hash } from "@lib/hash";
import { appConfig } from "@config/config";
import * as m from "@lib/models";
import hcaptcha from "hcaptcha";
import { hcaptchaEnabled } from "@config/apis";
import prettyMilliseconds from "pretty-ms";

export { m };

export async function createSession(ip: string, user: m.UserModel) {
  return (
    await db.query<m.SessionModel>(
      `INSERT INTO session(secret,ip,user_id) VALUES ($1,$2,$3) RETURNING *;`,
      [randomBytes(16).toString("hex"), ip, user.id]
    )
  ).rows[0];
}

export async function BanUser(
  userId: number,
  reason: string,
  expires: Date | null
) {
  if (reason === "") reason = "No reason specified.";

  return (
    await db.query<m.BanModel>(
      "INSERT INTO ban(expires,reason,user_id) VALUES($1,$2,$3) RETURNING *;",
      [expires, reason, userId]
    )
  ).rows[0];
}

export async function isUserBanned(
  userId: number
): Promise<m.BanModel | undefined> {
  const ban = (
    await db.query<m.BanModel>(
      "SELECT * FROM ban WHERE user_id = $1 AND (expires IS NULL OR expires > NOW())",
      [userId]
    )
  ).rows[0];

  return ban;
}

/**
 * hash a password with bcrypt
 */
export async function hashPassword(password: string) {
  return await hash(password);
}

// only called after the user verifies their email
export async function createStripeCustomer(user: m.UserModel) {
  const customer = await stripe.customers.create({
    // name: "Jenny Rosen",
    email: user.email,
  });

  user.stripe_customer = customer.id;
  await db.query("UPDATE users SET stripe_customer = $1 WHERE id = $2;", [
    customer.id,
    user.id,
  ]);
  console.log("new customer", customer);
  return user;
}

export async function unlinkDiscord(user: m.UserModel) {
  user.discord_id = null;
  user.discord_username = null;
  user.discord_avatar = null;
  user.discord_name = null;
  user.discord_updated = null;

  await db.query(
    "UPDATE users SET discord_id = null, discord_username = null, discord_avatar = null, discord_name = null, discord_updated = null WHERE id = $1;",
    [user.id]
  );
}

export interface DiscordUserData {
  id: string;
  username: string;
  avatar: string;
  global_name: string;
}

export async function linkDiscord(
  user: m.UserModel,
  userData: DiscordUserData
) {
  user.discord_id = userData.id;
  user.discord_username = userData.username;
  user.discord_avatar = userData.avatar;
  user.discord_name = userData.global_name;
  user.discord_updated = new Date();

  await db.query(
    "UPDATE users SET discord_id = $1, discord_username = $2, discord_avatar = $3, discord_name = $4, discord_updated = $5 WHERE id = $6;",
    [
      user.discord_id,
      user.discord_username,
      user.discord_avatar,
      user.discord_name,
      user.discord_updated,
      user.id,
    ]
  );
}

export async function validateCaptcha(
  token: any,
  realIp: string
): Promise<string | undefined> {
  if (!hcaptchaEnabled) return;
  if (typeof token !== "string") return "Invalid captcha token";
  // const t = useTranslations(language);
  const res = await hcaptcha.verify(appConfig.hcaptcha.secret, token, realIp);
  if (!res.success) {
    console.error("captcha fail", { res, realIp, token });
    return "Please try the captcha again.";
  }
  // if (!res.success) return t("feedback.captchaFailed");
}

export const HOUR = 60e3 * 60;
export const DAY = HOUR * 24;
export const MONTH = DAY * 30;

export async function addTimeToAccount(
  user: m.UserModel,
  time: string | number | bigint
) {
  const res = (
    await db.query<{ paid_until: Date }>(
      `UPDATE users SET paid_until = CASE WHEN paid_until <= NOW() THEN NOW() + ($1 * interval '1 millisecond') ELSE paid_until + ($1 * interval '1 millisecond') END WHERE id = $2 RETURNING paid_until;`,
      [time, user.id]
    )
  ).rows[0];
  user.paid_until = res.paid_until;
  return user;
}

function getNowpaymentsAPI() {
  return appConfig.nowpayments.sandbox
    ? "https://api-sandbox.nowpayments.io"
    : "https://api.nowpayments.io";
}

/**
 *
 * @param user
 * @param time amount of time to add- in milliseconds
 * @param price cost- in USD cents
 */
export async function createInvoice(
  user: m.UserModel,
  time: number,
  price: number
) {
  const token = randomBytes(8).toString("hex").toUpperCase();

  const invoice = (
    await db.query<m.InvoiceModel>(
      "INSERT INTO invoice(token,user_id,time,price) VALUES($1,$2,$3,$4) RETURNING *;",
      [token, user.id, time, price]
    )
  ).rows[0];

  const promises: Promise<void>[] = [];

  if (stripeEnabled)
    promises.push(
      (async () => {
        if (user.stripe_customer === null) await createStripeCustomer(user);

        const stripeInvoice = await stripe.invoices.create({
          number: invoice.id.toString(),
          description: invoice.token,
          customer: user.stripe_customer,
        });

        await stripe.invoiceItems.create({
          invoice: stripeInvoice.id,
          customer: user.stripe_customer,
          amount: price,
          currency: "USD",
          description: `Add ${prettyMilliseconds(time, {
            verbose: true,
          })} of time to your account`,
        });

        const finalizedInvoice = await stripe.invoices.finalizeInvoice(
          stripeInvoice.id
        );

        invoice.fiat_url = finalizedInvoice.hosted_invoice_url!;
      })()
    );

  if (nowpaymentsEnabled)
    promises.push(
      (async () => {
        const res = await fetch(getNowpaymentsAPI() + "/v1/invoice", {
          method: "POST",
          headers: {
            "x-api-key": appConfig.nowpayments.key,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            price_amount: price / 100,
            price_currency: "usd",
            order_id: invoice.id.toString(),
            order_description: invoice.token,
            // ipn_callback_url: origin + "/pro/dashboard",
            // success_url: "https://nowpayments.io",
            // cancel_url: "https://nowpayments.io",
          }),
        });

        if (!res.ok)
          throw new Error(
            `error creating crypto invoice: ${res.status} ${await res.text()}`
          );

        const data = (await res.json()) as { invoice_url: string };

        invoice.crypto_url = data.invoice_url;
      })()
    );

  await Promise.all(promises);

  // we can only get a URL when the invoice is finalized
  await db.query(
    "UPDATE invoice SET fiat_url = $1, crypto_url = $2 WHERE id = $3;",
    [invoice.fiat_url, invoice.crypto_url, invoice.id]
  );

  return invoice;
}

export * from "./validation";
