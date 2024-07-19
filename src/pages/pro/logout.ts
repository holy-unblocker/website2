import { db } from "@config/apis";
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

  return context.redirect("/pro/?bai", 302);
};
