import { appConfig } from "@config/config";
import { giveTierDiscordRoles } from "@config/apis";
import type { APIRoute } from "astro";
import { linkDiscord } from "@lib/util";

// we are redirected here after discord acc is complete
export const GET: APIRoute = async (context) => {
  const { user, acc } = context.locals;
  if (await acc.isBanned()) return acc.toBan();
  if (acc.needsToVerifyTotp()) return acc.toVerifyTotp();

  const code = context.url.searchParams.get("code");
  if (code === null) return new Response("wut", { status: 400 });

  // we need them to be signed innn
  // once they sign in, cus toLogin() is aware of the current URL, it'll redirect back to linkdiscord
  // then their acc will be linked
  if (!user) return acc.toLogin();

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: appConfig.discord.clientRedirectURI,
    }),
    headers: {
      authorization:
        "Basic " +
        Buffer.from(
          appConfig.discord!.clientId + ":" + appConfig.discord.clientSecret
        ).toString("base64"),
    },
    method: "POST",
  });

  if (!tokenRes.ok) {
    console.error(
      "error getting oauth2 token",
      tokenRes.status,
      await tokenRes.text()
    );
    return new Response("oops 1", { status: 500 });
  }

  const tokenData = (await tokenRes.json()) as {
    token_type: "Bearer";
    access_token: string;
    expires_in: number;
    refresh_token: string; // theres like no point in saving this lol
    scope: "identify"; // we dont need anything else lol just id, username, and avatar
  };

  console.log("got oauth token data:", tokenData);
  // fetch users info
  // id, avatar, username
  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      authorization: `${tokenData.token_type} ${tokenData.access_token}`,
    },
  });

  if (!userRes.ok) {
    console.error(
      "error getting user info",
      userRes.status,
      await userRes.text()
    );
    return new Response("oops 2", { status: 500 });
  }

  const userData = (await userRes.json()) as {
    id: string;
    username: string;
    avatar: string;
    global_name: string;
  };

  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${appConfig.discord.guildId}/members/${userData.id}`,
    {
      headers: {
        authorization: `Bot ${appConfig.discord.botToken}`,
      },
    }
  );

  if (memberRes.status === 404)
    return context.redirect("/pro/dashboard?disc_guild", 302);

  console.log("got data:", userData);

  // now we just add it
  await linkDiscord(user, userData);
  await giveTierDiscordRoles(user);

  return context.redirect("/pro/dashboard?disc_connected", 302);
};
