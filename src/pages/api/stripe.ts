import { appConfig } from "@config/config";
import { stripe, db, stripeEnabled } from "@config/apis";
import type { APIRoute } from "astro";
import type Stripe from "stripe";
import { addTimeToAccount, m } from "@lib/util";

export const POST: APIRoute = async ({ request }) => {
  if (!stripeEnabled)
    return new Response("Stripe integration disabled", { status: 400 });

  const signature = request.headers.get("stripe-signature");
  if (signature === null) return new Response(null, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      appConfig.stripe.webhookEndpointSecret
    );
  } catch (err) {
    // @ts-ignore`
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return new Response(null, { status: 400 });
  }

  console.log("got event:", event.type);

  // Handle the event
  switch (event.type) {
    case "invoice.paid":
      {
        const { object } = event.data;
        const invoice = (
          await db.query<m.InvoiceModel>(
            "UPDATE invoice SET paid = $1 WHERE id = $2 RETURNING *;",
            [new Date(), object.number]
          )
        ).rows[0];

        console.log("found the invoice:", invoice);

        const user = (
          await db.query<m.UserModel>("SELECT * FROM users WHERE id = $1;", [
            invoice.user_id,
          ])
        ).rows[0];

        console.log("found the user", user);

        await addTimeToAccount(user, invoice.time);

        if (!user) {
          console.error("could not find stripe customer", object.customer);
          return new Response(null, { status: 500 });
        }

        console.log(object);
      }
      break;
    default:
      // Unexpected event type
      console.log(`Unhandled event type ${event.type}.`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return new Response(null, { status: 200 });
};
