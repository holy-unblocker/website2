import { nowpaymentsEnabled } from "@config/apis";
import { appConfig } from "@config/config";
import type { APIRoute } from "astro";
import { createHmac } from "crypto";

export const POST: APIRoute = async ({ request }) => {
  if (!nowpaymentsEnabled)
    return new Response("NOWPayments integration disabled", { status: 400 });

  const receivedSignature = request.headers.get("x-nowpayments-sig");
  const params = await request.json();

  const hmac = createHmac("sha512", appConfig.nowpayments.notificationsKey);
  hmac.update(JSON.stringify(params, Object.keys(params).sort()));
  const signature = hmac.digest("hex");

  if (receivedSignature !== signature) {
    console.log(`⚠️ NOWPayments Webhook signature verification failed.`);
    return new Response(null, { status: 400 });
  }

  console.log("received data", params);

  // Return a 200 response to acknowledge receipt of the event
  return new Response(null, { status: 200 });
};
