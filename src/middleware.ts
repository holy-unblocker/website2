import { defineMiddleware } from "astro:middleware";

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.theme =
    context.cookies.get("theme")?.value === "night" ? "night" : "day";

  next();
});
