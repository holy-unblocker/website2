import { db, accountsEnabled } from "@config/apis";
import {
  m,
  isUserBanned,
  unlinkDiscord,
  linkDiscord,
  type DiscordUserData,
} from "@lib/util";
import { defineMiddleware } from "astro:middleware";
import engines from "@lib/searchEngines";
import { getRandomCloak, type AppCloak } from "@lib/cloak";
import { appConfig } from "@config/config";
import crypto from "node:crypto";

// 400 days in seconds
const maxAgeLimit = 60 * 60 * 24 * 400;

// use our default wisp api, which is hosted at /bare/
// see separateWispServer in ./config/config.js to change this by default
const defaultWispServer =
  typeof appConfig.separateWispServer === "string"
    ? appConfig.separateWispServer
    : "%{ws}//%{host}/api/wisp/";

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  // do redirect stuff because im an idiot
  // oops
  if (context.url.pathname.startsWith("/donate/"))
    return context.redirect(
      "/pro" + context.url.pathname.slice("/donate".length),
      301
    );
  if (context.url.pathname.startsWith("/sub/"))
    return context.redirect(
      "/pro" + context.url.pathname.slice("/sub".length),
      301
    );

  const clientKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  context.locals.clientKey = Buffer.concat([iv, clientKey]).toString("base64");

  const encryptText = async (text: string) => {
    const cipher = crypto.createCipheriv("aes-256-cbc", clientKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const ivAndCiphertext = encrypted.toString("base64");
    return ivAndCiphertext;
  };

  context.locals.encryptText = encryptText;

  const proto = ["localhost", "127.0.0.1"].includes(context.url.hostname)
    ? "http:"
    : "https:";
  context.locals.origin = proto + "//" + context.url.host;

  // context.locals.obfus = new HolyObfuscator(context.url.hostname, context.locals.isMainWebsite);

  context.locals.isMainWebsite =
    !("mainWebsite" in appConfig) ||
    context.url.hostname === appConfig.mainWebsite;

  // saves the wispServer or delete it
  context.locals.setWispServer = (newWispServer) => {
    let validWispServer = typeof newWispServer === "string";

    if (validWispServer)
      try {
        new URL(newWispServer as string);
      } catch (err) {}

    if (validWispServer) {
      context.cookies.set("wispServer", newWispServer as string, {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeLimit,
        secure: true,
      });
      context.locals.wispServer = newWispServer as string;
      return true;
    } else {
      // clear the cookie
      if (context.cookies.has("wispServer"))
        context.cookies.set("wispServer", "", {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/",
          expires: new Date(0), // set it to as old as possible!!
          secure: true,
        });
      context.locals.wispServer = defaultWispServer;
      return false;
    }
  };
  context.locals.setWispServer(context.cookies.get("wispServer")?.value);

  // encode the cloak or delete it
  context.locals.setCloak = (cloak) => {
    let validCloak = typeof cloak === "object" && cloak !== null;

    if (validCloak) {
      if (typeof (cloak as AppCloak).icon !== "string") validCloak = false;
      if (typeof (cloak as AppCloak).title !== "string") validCloak = false;
      if (typeof (cloak as AppCloak).url !== "string") validCloak = false;
    }

    if (validCloak) {
      context.cookies.set(
        "cloak",
        new URLSearchParams({ ...cloak }).toString(),
        {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/",
          maxAge: maxAgeLimit,
          secure: true,
        }
      );
      return true;
    } else {
      // clear the cloak
      if (context.cookies.has("cloak"))
        context.cookies.set("cloak", "", {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/",
          expires: new Date(0), // as old as possible
          secure: true,
        });
      return false;
    }
  };

  // pick a random cloak on the first load
  // don't run this on holyubofficial.net so we get SEO
  if (
    !context.cookies.has("autoCloak") &&
    !context.locals.isMainWebsite &&
    ["document", "iframe"].includes(
      context.request.headers.get("sec-fetch-dest")!
    )
  ) {
    const cloak = await getRandomCloak();
    if (cloak) context.locals.setCloak(cloak);
    context.locals.cloak = cloak;
  } else {
    const cloakCookie = context.cookies.get("cloak");
    if (cloakCookie !== undefined) {
      context.locals.cloak = Object.fromEntries([
        ...new URLSearchParams(cloakCookie.value).entries(),
      ]) as any;
    }
  }

  // indicate that the cloak was already randomly picked
  context.cookies.set("autoCloak", "1", {
    domain: context.url.hostname,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeLimit,
    secure: true,
    httpOnly: true,
  });

  // saves the theme or delete it
  context.locals.setTheme = (newTheme) => {
    const validTheme =
      typeof newTheme === "string" && ["day", "night"].includes(newTheme);

    if (validTheme) {
      context.cookies.set("theme", newTheme as string, {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeLimit,
        secure: true,
      });
      context.locals.theme = newTheme as string;
      return true;
    } else {
      // clear the cookie
      if (context.cookies.has("theme"))
        context.cookies.set("theme", "", {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/",
          expires: new Date(0), // set it to as old as possible!!
          secure: true,
        });
      context.locals.theme = "day"; // default is day
      return false;
    }
  };

  context.locals.setTheme(context.cookies.get("theme")?.value);

  // saves the search engine or delete it
  context.locals.setSearchEngine = (newSearchEngine) => {
    let validSearchEngine = false;
    if (typeof newSearchEngine === "string")
      newSearchEngine = parseInt(newSearchEngine);
    if (
      typeof newSearchEngine === "number" &&
      !isNaN(newSearchEngine) &&
      newSearchEngine >= 0 &&
      newSearchEngine < engines.length
    )
      validSearchEngine = true;
    if (validSearchEngine) {
      context.cookies.set("srch", (newSearchEngine as number).toString(), {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeLimit,
        secure: true,
      });
      context.locals.searchEngine = newSearchEngine as number;
      return true;
    } else {
      // clear the cookie
      if (context.cookies.has("srch"))
        context.cookies.set("srch", "", {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/",
          expires: new Date(0), // set it to as old as possible!!
          secure: true,
        });

      // default proxy search engine
      // 0 = google
      // 1 = duckduckgo
      // 2 = bing
      // 3 = wikipedia
      // 4 = reddit
      // 5 = hacker news
      context.locals.searchEngine = 1;
      return false;
    }
  };
  context.locals.setSearchEngine(context.cookies.get("srch")?.value);

  // proxy mode
  context.locals.proxyMode = "embedded";
  const proxyMode = context.cookies.get("prx")?.value;
  if (
    proxyMode !== undefined &&
    ["embedded", "redirect", "about:blank"].includes(proxyMode)
  )
    context.locals.proxyMode = proxyMode;

  if (!accountsEnabled) {
    if (context.url.pathname.startsWith("/pro/"))
      return new Response("Account system is disabled", { status: 400 });
    // don't bother loading logic for account stuff
    return next();
  }

  context.locals.setSession = (secret, staySignedIn = true) => {
    // set the session
    if (typeof secret === "string") {
      context.cookies.set("session", secret, {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/pro/",
        maxAge: staySignedIn ? maxAgeLimit : undefined,
        secure: true,
        httpOnly: true,
      });

      return true;
    } else {
      // clear the session
      if (context.cookies.has("session"))
        context.cookies.set("session", "", {
          domain: context.url.hostname,
          sameSite: "lax",
          path: "/pro/",
          expires: new Date(0), // set it to as old as possible!!
          secure: true,
          httpOnly: true,
        });

      return false;
    }
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
      ).rows[0] as CtxUser;

      if (!user) {
        console.error(
          "session had a reference to a non existant user...,erm what"
        );
        context.locals.setSession();
      } else {
        user.session = session;
        context.locals.user = user;

        // check if discord account data is older than one day
        if (
          user.discord_updated !== null &&
          Date.now() - user.discord_updated.getTime() > 60e3 * 60 * 24
        ) {
          console.log("discord data out of date");
          const memberRes = await fetch(
            `https://discord.com/api/v10/guilds/${appConfig.discord.guildId}/members/${user.discord_id}`,
            {
              headers: {
                authorization: `Bot ${appConfig.discord.botToken}`,
              },
            }
          );

          switch (memberRes.status) {
            case 200:
              {
                const data = (await memberRes.json()) as {
                  user: DiscordUserData;
                };
                await linkDiscord(user, data.user);
                console.log("fetched new discord data");
              }
              break;
            case 404:
              console.error("Member no longer in guild");
              await unlinkDiscord(user);
              break;
            default:
              console.error("Bad discord response:", memberRes.status);
              console.error(await memberRes.text());
              break;
          }

          if (!memberRes.ok) {
            console.error("error updating guild member:", memberRes.status);
          }
        }

        // don't set it again
        // respect whether the user picked to stay signed in or not
        // context.locals.setSession(cookie);
      }
    } else {
      // invalid
      context.locals.setSession();
    }
  }

  context.locals.ip = context.clientAddress;
  // context.request.headers.get("cf-connecting-ip") || context.clientAddress;

  context.locals.acc = {
    isPremium: () => {
      const { user } = context.locals;
      if (!user) return false;
      return Date.now() < user.paid_until.getTime();
    },
    isBanned: async () => {
      if (context.locals.user) {
        return await isUserBanned(context.locals.user.id);
      }
    },
    needsToVerifyTotp: () => {
      const { user } = context.locals;
      if (!user) return false;
      return user.totp_enabled !== null && !user.session.totp_verified;
    },
    toDash: () => context.redirect("/pro/dashboard", 302),
    toBan: () => context.redirect("/pro/ban", 302),
    toPricing: () => context.redirect("/pro/tiers", 302),
    toLogin: () =>
      context.redirect(
        context.url.pathname === "/pro/signup"
          ? "/pro/signup"
          : `/pro/?to=${encodeURIComponent(
              context.url.pathname + context.url.search
            )}`,
        307
      ),
    toSignup: () =>
      context.redirect(
        context.url.pathname === "/pro/"
          ? "/pro/"
          : `/pro/?to=${encodeURIComponent(
              context.url.pathname + context.url.search
            )}`,
        307
      ),
    toVerifyEmail: () => context.redirect("/pro/verify-email", 302),
    toVerifyNewEmail: () => context.redirect("/pro/verify-new-email", 302),
    toVerifyTotp: () => context.redirect("/pro/verify-totp", 302),
  };

  return next();
});
