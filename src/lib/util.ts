import { db, mailer, stripe } from "@config/apis";
import { randomBytes } from "node:crypto";
import { hash } from "@lib/bcrypt";
import { appConfig } from "@config/config";
import * as m from "@lib/models";

export { m };

export async function createSession(ip: string, userId: number) {
  return (
    await db.query<m.SessionModel>(
      `INSERT INTO session(secret,ip,user_id) VALUES ($1,$2,$3) RETURNING *;`,
      [randomBytes(16).toString("hex"), ip, userId],
    )
  ).rows[0];
}

export async function IpBan(ip: string, reason: string, expires: Date | null) {
  return (
    await db.query<m.IpBanModel>(
      "INSERT INTO ipban(expires,reason,ip) VALUES($1,$2,$3);",
      [expires, reason, ip],
    )
  ).rows[0];
}

export async function BanUser(
  userId: number,
  reason: string,
  expires: Date | null,
) {
  if (reason === "") reason = "No reason specified.";

  return (
    await db.query<m.BanModel>(
      "INSERT INTO ban(expires,reason,user_id) VALUES($1,$2,$3) RETURNING *;",
      [expires, reason, userId],
    )
  ).rows[0];
}

export async function IpBanUser(
  ip: string,
  userId: number,
  expires: Date | null,
  reason: string,
) {
  if (reason === "") reason = "No reason specified.";

  return {
    ipban: (
      await db.query<m.IpBanModel>(
        "INSERT INTO ipban(expires,reason,ip,user_id) VALUES($1,$2,$3,$4);",
        [expires, reason, ip, userId],
      )
    ).rows[0],
    ban: await BanUser(userId, reason, expires),
  };
}

export async function isIPBanned(
  ip: string,
): Promise<m.IpBanModel | undefined> {
  const ban = (
    await db.query<m.IpBanModel>(
      "SELECT * FROM ipban WHERE ip = $1 AND (expires IS NULL OR expires > NOW())",
      [ip],
    )
  ).rows[0];

  return ban;
}

export async function isUserBanned(
  userId: number,
): Promise<m.BanModel | undefined> {
  const ban = (
    await db.query<m.IpBanModel>(
      "SELECT * FROM ban WHERE user_id = $1 AND (expires IS NULL OR expires > NOW())",
      [userId],
    )
  ).rows[0];

  return ban;
}

/**
 * hash a password with bcrypt
 */
export async function hashPassword(password: string) {
  return await hash(password, 10);
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
  ip: string,
): Promise<string | undefined> {
  const sent = (
    await db.query<m.EmailModel>(
      `SELECT * FROM email WHERE email = $1 OR ip = $2;`,
      [email, ip],
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
  verificationSecret: string,
) {
  const url = `https://${host}/pro/verify-new-email?secret=${encodeURIComponent(
    verificationSecret,
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
  ip: string,
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
  ip: string,
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
    user.email_verification_code,
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
  verificationSecret: string,
) {
  const url = `https://${host}/pro/forgot-password?secret=${encodeURIComponent(
    verificationSecret,
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
  return customer;
}

export * from "./validation";
