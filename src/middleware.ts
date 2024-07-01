import { db, stripeEnabled } from "@config/apis";
import { m, isIPBanned, isUserBanned } from "@lib/util";
import { maxAgeLimit } from "@lib/url";
import { defineMiddleware } from "astro:middleware";
import engines from "@lib/searchEngines";
import { extractCloakData, type AppCloak } from "@lib/cloak";
import { appConfig } from "@config/config";

const randomCloaks: (string | AppCloak)[] = [
  // LMS:
  // // some  of these are links to the product, not the actual LMS...
  "https://clever.com/oauth/district-picker",
  "https://kahoot.it/",
  "https://moodle.com/login/",
  // 'https://www.opensesame.com/',
  "https://www.opensesame.com/user/login",
  // 'https://www.instructure.com/en-au/canvas',
  "https://www.olivevle.com/contact-us/",
  "https://readingsohs.edvance360.com/",
  // 'https://www.absorblms.com/myabsorb-lms-login-help',
  "https://suite.vairkko.com/APP/index.cfm/account/Login?reqEvent=main.index&qs=",
  "https://articulate.com/360",
  "https://www.blackboard.com/student-resources",
  // 'https://www.sap.com/products/hcm/hxm-suite.html',
  // 'https://www.cornerstoneondemand.com/solutions/learning-and-development-lms/',
  "https://bridgelt.com/lms",
  {
    icon: "https://ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  {
    icon: "https:////ssl.gstatic.com/classroom/ic_product_classroom_32.png",
    title: "Classes",
    url: "https://classroom.google.com/",
  },
  // ETC:
  "about:blank",
  // 'https://openai.com/',
  "https://getfedora.org/",
  "https://www.debian.org/",
  "https://www.opensuse.org",
  // 'https://nodejs.org/en/',
  "https://www.microsoft.com/en-us/",
  "https://nextjs.org/docs/getting-started",
  "https://addons.mozilla.org/en-US/firefox/",
  "https://addons.mozilla.org/en-US/firefox/addon/fate-stay-night-trace-on/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=featured",
  "https://developer.mozilla.org/en-US/plus",
  "https://huggingface.co/",
  "https://huggingface.co/docs",
  "https://www.google.com/chromebook/",
  "https://workshop.premiumretail.io/external/landing/6b1c3d1225ebd/",
  "https://https://beta.reactjs.org/",
  "https://photomath.com/",
  "https://photomath.com/en/termsofuse",
  "https://www.mathway.com/Algebra",
  "https://monkeytype.com/security-policy",
  "https://www.bbcgoodfood.com/howto/guide/baking-beginners",
  "https://smallbusiness.withgoogle.com/",
];

async function getRandomCloak(): Promise<string | AppCloak | undefined> {
  let retries = 5;

  while (true) {
    let cloak = randomCloaks[~~(Math.random() * randomCloaks.length)];
    try {
      if (typeof cloak === "string") cloak = await extractCloakData(cloak);
      return cloak;
    } catch (err) {
      console.error("Error fetching random cloak:", cloak, err);
      retries--;
      if (retries === 0) {
        console.error("Max retries exceeded for cloak");
        break;
      }
    }
  }
}

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  // oops
  if (context.url.pathname.startsWith("/donate/"))
    return context.redirect(
      "/sub" + context.url.pathname.slice("/donate".length),
      301
    );

  context.locals.isMainWebsite =
    !("mainWebsite" in appConfig) ||
    context.url.hostname === appConfig.mainWebsite;

  // encode the cloak or delete it
  context.locals.setCloak = (cloak) => {
    if (cloak)
      context.cookies.set("cloak", cloak, {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeLimit,
        secure: true,
      });
    // clear the cloak
    else
      context.cookies.set("cloak", "", {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/",
        expires: new Date(0), // as old as possible
        secure: true,
      });
  };

  let cloak = context.cookies.get("cloak")?.json();

  // pick a random cloak on the first load
  // don't run this on holyubofficial.net so we get SEO
  if (!context.cookies.has("autoCloak") && !context.locals.isMainWebsite) {
    cloak = await getRandomCloak();
    if (cloak) context.locals.setCloak(cloak);
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

  context.locals.cloak = cloak;

  context.locals.theme =
    context.cookies.get("theme")?.value === "night" ? "night" : "day";

  const searchEngine = Number(context.cookies.get("searchEngine")?.value);

  // use duckduckgo by default
  context.locals.searchEngine =
    isNaN(searchEngine) || searchEngine < 0 || searchEngine > engines.length
      ? 1
      : searchEngine;

  if (!stripeEnabled) {
    if (
      context.url.pathname.startsWith("/sub/") ||
      context.url.pathname === "/api/supersecretstripe"
    )
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
        path: "/sub/",
        maxAge: maxAgeLimit,
        secure: true,
        httpOnly: true,
      });
    // clear the session
    else
      context.cookies.set("session", "", {
        domain: context.url.hostname,
        sameSite: "lax",
        path: "/sub/",
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
          path: "/sub/",
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
    toDash: () => context.redirect("/sub/dashboard", 302),
    toBan: () => context.redirect("/sub/ban", 302),
    toPricing: () => context.redirect("/sub/pricing", 302),
    toLogin: () =>
      context.redirect(
        context.url.pathname === "/sub/login"
          ? "/sub/login"
          : `/sub/login?to=${encodeURIComponent(
              context.url.pathname + context.url.search
            )}`,
        307
      ),
    toSignup: () =>
      context.redirect(
        context.url.pathname === "/sub/"
          ? "/sub/"
          : `/sub/?to=${encodeURIComponent(
              context.url.pathname + context.url.search
            )}`,
        307
      ),
    toVerifyEmail: () => context.redirect("/sub/verify-email", 302),
    toVerifyNewEmail: () => context.redirect("/sub/verify-new-email", 302),
  };

  return next();
});
