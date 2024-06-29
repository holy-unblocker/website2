import { db } from "@lib/db";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;
  if (user) {
    // delete it
    await db.query(`DELETE FROM session WHERE secret = $1;`, [
      user.session.secret,
    ]);
    // clear the cookie
    context.locals.setSession();
  }

  return context.redirect("/donate/login?bai", 302);
};
