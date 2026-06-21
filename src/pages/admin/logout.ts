import { db } from "@config/apis";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;
  if (user) {
    await db.query(`DELETE FROM session WHERE secret = $1;`, [
      user.session.secret,
    ]);
    context.locals.setSession();
  }

  return context.redirect("/admin/login", 302);
};
