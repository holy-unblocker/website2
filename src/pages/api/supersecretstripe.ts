import { appConfig } from "@config/config";
import { stripe, db } from "@config/apis";
import type { APIRoute } from "astro";
import type Stripe from "stripe";

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get("stripe-signature");
  if (signature === null) return new Response(null, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      appConfig.stripe.webhookEndpointSecret,
    );
  } catch (err) {
    // @ts-ignore`
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return new Response(null, { status: 400 });
  }

  console.log("got event:", event);

  // Handle the event
  switch (event.type) {
    case "invoice.paid":
      // Continue to provision the subscription as payments continue to be made.
      // Store the status in your database and check when a user accesses your service.
      // This approach helps you avoid hitting rate limits.
      {
        const object = event.data.object;
        const user = (
          await db.query("SELECT * FROM users WHERE stripe_customer = $1;", [
            object.customer,
          ])
        ).rows[0];

        if (!user) {
          console.error("could not find stripe customer", object.customer);
          return new Response(null, { status: 500 });
        }

        console.log(object, object.lines.data[0]);

        // there should probably be only one payment line
        for (const line of object.lines.data) {
          if (!line.plan) {
            console.error("expected a PLAN on the INVOICE line");
            return new Response(null, { status: 500 });
          }

          let tier: number | undefined;

          switch (line.plan.id) {
            case appConfig.stripe.priceIds.official:
              tier = 1;
              break;
            case appConfig.stripe.priceIds.ultimate:
              tier = 2;
              break;
            case appConfig.stripe.priceIds.meal:
              tier = 3;
              break;
          }

          if (tier === undefined) {
            console.error("expected the PLAN to be an actual PRODUCT");
            return new Response(null, { status: 500 });
          }

          // period is in seconds
          // so convert to js timestamp
          const start = new Date(line.period.start * 1000);
          const end = new Date(line.period.end * 1000);

          console.log("invoice line:", line);

          await db.query(
            "INSERT INTO payment(invoice_id,subscription_id,user_id,tier,period_start,period_end) VALUES($1,$2,$3,$4,$5,$6);",
            [line.id, line.subscription, user.id, tier, start, end],
          );
        }
      }
      break;
    case "invoice.payment_failed":
      // The payment failed or the customer does not have a valid payment method.
      // The subscription becomes past_due. Notify your customer and send them to the
      // customer portal to update their payment information.
      break;

    default:
      // Unexpected event type
      console.log(`Unhandled event type ${event.type}.`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return new Response(null, { status: 200 });
};
