import { db, theatreAdminSignupEnabled } from "@config/apis";
import { createSession, m } from "@lib/util";
import { hashPassword, isUserBanned } from "@lib/util";
import { verify } from "@lib/hash";
import { validateEmail, validatePassword } from "@lib/validation";
import type { APIContext } from "astro";

export async function countAdmins() {
  const row = (
    await db.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE admin = true;",
    )
  ).rows[0];

  return Number(row?.count || 0);
}

export async function canBootstrapTheatreAdmin() {
  return theatreAdminSignupEnabled && (await countAdmins()) === 0;
}

/**
 * Attempt to log an admin in with the given credentials. Returns an error
 * string on failure, or sets the session and returns undefined on success.
 */
export async function loginAdmin(
  context: APIContext,
  email: string,
  password: string,
): Promise<string | undefined> {
  if (email === "") return "Please enter your email.";
  if (password === "") return "Please enter your password.";

  const user = (
    await db.query<m.UserModel>("SELECT * FROM users WHERE email = $1;", [
      email,
    ])
  ).rows[0];

  if (!user || !(await verify(password, user.password_hash)))
    return "Incorrect email or password.";

  if (!user.admin) return "This account is not an administrator.";

  if (await isUserBanned(user.id)) return "This account is banned.";

  const session = await createSession(context.locals.ip, user);
  context.locals.setSession(session.secret);
}

/**
 * Create the first theatre admin account. Returns an error string on failure,
 * or sets the session and returns undefined on success.
 */
export async function signupAdmin(
  context: APIContext,
  email: string,
  password: string,
): Promise<string | undefined> {
  if (!(await canBootstrapTheatreAdmin()))
    return "Admin signup is not available.";

  const error = validateEmail(email) || validatePassword(password);
  if (error) return error;

  const now = new Date();

  try {
    const user = (
      await db.query<m.UserModel>(
        "INSERT INTO users(email,email_verified,password_hash,admin,signup_ip,created,paid_until) VALUES($1,true,$2,true,$3,$4,$5) RETURNING *;",
        [email, await hashPassword(password), context.locals.ip, now, now],
      )
    ).rows[0];

    const session = await createSession(context.locals.ip, user);
    context.locals.setSession(session.secret);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message ===
        'duplicate key value violates unique constraint "users_email_key"'
    )
      return "An account with that email already exists.";

    console.error("admin signup error:", err);
    return "An internal error occurred. Please try again.";
  }
}

export function requireTheatreAdmin(context: APIContext) {
  if (!context.locals.user)
    return new Response(JSON.stringify({ message: "Login required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  if (!context.locals.user.admin)
    return new Response(JSON.stringify({ message: "Admin access required" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
}
