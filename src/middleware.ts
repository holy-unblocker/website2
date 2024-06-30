import { db } from "@lib/db";
import { m, isIPBanned, isUserBanned, stripe } from "@lib/util";
import { maxAgeLimit } from "@lib/url";
import { defineMiddleware } from "astro:middleware";
import engines from "@lib/engines";

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.theme =
    context.cookies.get("theme")?.value === "night" ? "night" : "day";

  const searchEngine = Number(context.cookies.get("searchEngine")?.value);

  // use duckduckgo by default
  context.locals.searchEngine =
    isNaN(searchEngine) || searchEngine < 0 || searchEngine > engines.length
      ? 1
      : searchEngine;

  if (!stripe) {
    if (context.url.pathname.startsWith("/donate/"))
      return new Response("accounts are disabled", { status: 400 });
    // don't bother loading logic for account stuff
    return next();
  }

  context.locals.setSession = (secret) => {
    // set the session
    if (secret)
      context.cookies.set("session", secret, {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/donate/",
        maxAge: maxAgeLimit,
        secure: true,
        httpOnly: true,
      });
    // clear the session
    else
      context.cookies.set("session", "", {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/donate/",
        expires: new Date(0), // as old as possible
        secure: true,
        httpOnly: true,
      });
  };

  const cookie = context.cookies.get("session")?.value;

  if (cookie) {
    const session = (
      await db.query<m.SessionModel>(
        `SELECT * FROM session WHERE secret = $1;`,
        [cookie]
      )
    ).rows[0];

    if (session) {
      const user = (
        await db.query<m.UserModel>(`SELECT * FROM users WHERE id = $1;`, [
          session.user_id,
        ])
      ).rows[0];
      const e = user as CtxUser;

      if (!e) {
        console.error(
          "session had a reference to a non existant user...,erm what"
        );
        context.locals.setSession();
      } else {
        e.session = session;
        context.locals.user = e;

        context.cookies.set("session", cookie, {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/donate/",
          maxAge: maxAgeLimit,
          secure: true,
          httpOnly: true,
        });
      }
    } else {
      // invalid
      context.locals.setSession();
    }
  }

  context.locals.ip = context.clientAddress;
  // context.request.headers.get("cf-connecting-ip") || context.clientAddress;

  context.locals.acc = {
    isBanned: async () => {
      const ipBan = await isIPBanned(context.locals.ip);

      if (ipBan) {
        const e = ipBan as m.IpBanModel & { type: "ip" };
        e.type = "ip";
        return e;
      }

      if (context.locals.user) {
        const ban = await isUserBanned(context.locals.user.id);
        if (ban) {
          const e = ban as m.BanModel & { type: "ban" };
          e.type = "ban";
          return e;
        }
      }
    },
    toDash: () => context.redirect("/donate/dashboard", 302),
    toBan: () => context.redirect("/donate/ban", 302),
    toPricing: () => context.redirect("/donate/pricing", 302),
    toLogin: () =>
      context.redirect(
        context.url.pathname === "/donate/login"
          ? "/donate/login"
          : `/donate/login?to=${encodeURIComponent(
              context.url.pathname + context.url.search
            )}`,
        307
      ),
    toSignup: () =>
      context.redirect(
        context.url.pathname === "/donate/"
          ? "/donate/"
          : `/donate/?to=${encodeURIComponent(
              context.url.pathname + context.url.search
            )}`,
        307
      ),
    toVerifyEmail: () => context.redirect("/donate/verify-email", 302),
    toVerifyNewEmail: () => context.redirect("/donate/verify-new-email", 302),
  };

  return next();
});
