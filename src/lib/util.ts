import { db, mailer, stripe } from "@config/apis";
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

export function generateVerificationCode() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let randomCode = "";

  for (let i = 0; i < 8; i++) {
    let randomNum = Math.floor(Math.random() * characters.length);
    randomCode += characters[randomNum];
  }

  return randomCode;
}

export function generateVerificationSecret() {
  return randomBytes(16).toString("base64");
}

// in seconds
const spamThreshold = 30e3;

export async function canSendEmail(
  user: m.UserModel,
  email: string,
  ip: string
): Promise<string | undefined> {
  const sent = (
    await db.query<m.EmailModel>(
      `SELECT * FROM email WHERE email = $1 OR ip = $2;`,
      [email, ip]
    )
  ).rows;

  const now = Date.now();
  for (const e of sent) {
    const t = e.send_time.getTime();
    const r = now - t;
    if (r <= spamThreshold) {
      const s = Math.ceil((t + spamThreshold - now) / 1000);
      return `Please wait${s === 0 ? "" : " " + s + " more seconds"}`;
    }
  }

  // record it
  await db.query("INSERT INTO email(email,ip,user_id) VALUES($1,$2,$3);", [
    user.email,
    ip,
    user.id,
  ]);
}

const emailCSS = `div{background:#fff;padding:20px;font-family:"Helvetica Neue","Helvetica","Arial","sans-serif"}`;
const verifyCSS = `#verify{color:#fff;background:#0078d4;padding:5px 10px;border:0;border-radius:5px;text-decoration:none}`;

export async function sendChangeEmailVerification(
  host: string,
  user: m.UserModel,
  newEmail: string,
  verificationSecret: string
) {
  const url = `https://${host}/pro/verify-new-email?secret=${encodeURIComponent(
    verificationSecret
  )}`;

  console.log("DEBUG CHANGE EMAIL VERIFICATION", [
    user.id,
    newEmail,
    verificationSecret,
    url,
  ]);

  await mailer.sendMail({
    to: newEmail,
    sender: appConfig.mailer.sender,
    from: appConfig.mailer.noreply,
    subject: "Confirm your new email",
    html: `<style>${emailCSS}${verifyCSS}</style><div>
<p>To finish changing your Holy Unblocker account's email address from ${user.email} to ${newEmail}, click the button below.</p>
<a href="${url}" id="verify">Verify Email</a>
<p>Or go to <a href="${url}">${url}</a></p>
<p>You can log into your Holy Unblocker account at <a href="https://${appConfig.mainWebsite}/pro/">${appConfig.mainWebsite}</a></p>
</div>`,
  });
}

export async function sendChangePasswordNotification(
  user: m.UserModel,
  ip: string
) {
  // todo: add a recovery secret thats valid for only 30 days
  console.log("DEBUG CHANGE PASSWORD NOTIFICATION", [user.id]);

  await mailer.sendMail({
    to: user.email,
    sender: appConfig.mailer.sender,
    from: appConfig.mailer.noreply,
    subject: "Password changed",
    html: `<style>${emailCSS}${verifyCSS}</style><div>
<p>Your account's password was changed.</p>
<p>This change was initiated by ${ip}</p>
<p>You can log into your Holy Unblocker account at <a href="https://${appConfig.mainWebsite}/pro/">${appConfig.mainWebsite}</a></p>
</div>`,
  });
}

export async function sendChangeEmailNotification(
  user: m.UserModel,
  ip: string
) {
  // todo: add a recovery secret thats valid for only 30 days
  console.log("DEBUG CHANGE EMAIL NOTIFICATION", [user.id]);

  await mailer!.sendMail({
    to: user.email,
    sender: appConfig.mailer.sender,
    from: appConfig.mailer.noreply,
    subject: "Email changed",
    html: `<style>${emailCSS}${verifyCSS}</style><div>
<p>Your account's password was changed to ${user.new_email}.</p>
<p>This change was initiated by ${ip}</p>
<p>You can log into your Holy Unblocker account at <a href="https://${appConfig.mainWebsite}/pro/">${appConfig.mainWebsite}</a></p>
</div>`,
  });
}

export async function sendEmailVerification(user: m.UserModel) {
  console.log(
    "DEBUG EMAIL VERIFICATION",
    user.email,
    user.email_verification_code
  );

  await mailer.sendMail({
    to: user.email,
    sender: appConfig.mailer.sender,
    from: appConfig.mailer.noreply,
    subject: "Finish creating your account",
    html: `<style>${emailCSS}span{font-family:monospace}</style><div>
<p>To finish creating your Holy Unblocker account, enter this verification code: <span>${user.email_verification_code}</span></p>
<p>If this wasn't you, then you can ignore this email.</p>
<p>You can log into your Holy Unblocker account at <a href="https://holyubof${appConfig.mainWebsite}/pro/">${appConfig.mainWebsite}</a></p>`,
  });
}

export async function sendPasswordVerification(
  host: string,
  email: string,
  verificationSecret: string
) {
  const url = `https://${host}/pro/forgot-password?secret=${encodeURIComponent(
    verificationSecret
  )}`;

  console.log("DEBUG PASSWORD VERIFICATION", {
    email,
    verificationSecret,
    url,
  });

  await mailer!.sendMail({
    to: email,
    sender: appConfig.mailer.sender,
    from: appConfig.mailer.noreply,
    subject: "Password change request",
    html: `<style>${emailCSS}${verifyCSS}</style>
<p>Someone requested to change your password on Holy Unblocker. To reset your account password, click the button below.</p>
<a href="${url}" id="verify">Change Password</a>
<p>Or go to <a href="${url}">${url}</a></p>
<p>If this wasn't you, then you can ignore this request.</p>
<p>You can log into your Holy Unblocker account at <a href="https://${appConfig.mainWebsite}/pro/">${appConfig.mainWebsite}</a></p>`,
  });
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

  console.log({ res });
  user.paid_until = res.paid_until;
  return user;
}

/**
 *
 * @param user
 * @param time amount of time to add- in milliseconds
 * @param price cost- in USD cents
 * @param type type of invoice to create
 */
export async function createInvoice(
  user: m.UserModel,
  time: number,
  price: number,
  type: "fiat" | "crypto"
) {
  const token = randomBytes(8).toString("hex").toUpperCase();

  const invoice = (
    await db.query<m.InvoiceModel>(
      "INSERT INTO invoice(token,user_id,time,price,type) VALUES($1,$2,$3,$4,$5) RETURNING *;",
      [token, user.id, time, price, type]
    )
  ).rows[0];

  switch (type) {
    case "fiat":
      {
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

        invoice.url = finalizedInvoice.hosted_invoice_url!;
      }
      break;
    case "crypto":
      throw new Error("not supported yet!");
    default:
      throw new TypeError(`invalid invoice type: ${type}`);
  }

  // we can only get a URL when the invoice is finalized
  await db.query("UPDATE invoice SET url = $1 WHERE id = $2;", [
    invoice.url,
    invoice.id,
  ]);

  return invoice;
}

export * from "./validation";
