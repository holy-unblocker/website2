import { appConfig } from "@config/config";
import { stripe } from "@lib/util";
import type { APIRoute } from "astro";
import type Stripe from "stripe";

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get("stripe-signature");
  if (signature === null) return new Response(null, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe!.webhooks.constructEvent(
      await request.text(),
      signature,
      appConfig.stripe!.endpointSecret
    );
  } catch (err) {
    // @ts-ignore`
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return new Response(null, { status: 400 });
  }

  console.log("got event:", event);

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      // Payment is successful and the subscription is created.
      // You should provision the subscription and save the customer ID to your database.
      // we already save the customer id!!

      break;
    case "invoice.paid":
      // Continue to provision the subscription as payments continue to be made.
      // Store the status in your database and check when a user accesses your service.
      // This approach helps you avoid hitting rate limits.
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
