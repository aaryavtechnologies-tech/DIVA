/* ============================================================
   DIVA JEWELS — razorpay-webhook
   ------------------------------------------------------------
   Called by RAZORPAY'S SERVERS, not the browser — this is what
   guarantees payment_status is only ever set to 'paid' after Razorpay
   itself confirms it, even if the customer's browser crashes right
   after paying. Never trust a client-side "payment success" callback
   for anything beyond an optimistic UI update.

   Security:
   - Verifies the `x-razorpay-signature` header against the raw request
     body using RAZORPAY_WEBHOOK_SECRET (a separate secret from your
     API Key Secret — set it when you create the webhook in the
     Razorpay dashboard, see the deploy notes below).
   - No CORS is applied here on purpose: this endpoint is never called
     from a browser, only server-to-server from Razorpay, so a CORS
     allowlist doesn't apply. The signature check is what authenticates
     the caller.
   - Uses the service_role key to update orders, bypassing RLS — this
     is trusted server code, the one place outside the admin panel
     that's allowed to flip payment_status.

   Deploy:
     supabase functions deploy razorpay-webhook --no-verify-jwt
   Secrets:
     supabase secrets set RAZORPAY_WEBHOOK_SECRET=...
   Then in the Razorpay Dashboard → Settings → Webhooks:
     - Webhook URL: https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
     - Secret: the same value as RAZORPAY_WEBHOOK_SECRET above
     - Active events: payment.captured, payment.failed
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish comparison — length check first, then compare
  // every byte instead of short-circuiting on the first mismatch.
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.error("Missing RAZORPAY_WEBHOOK_SECRET secret.");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  // Signature is computed over the RAW body text — read it once as
  // text, never as parsed JSON first, or the byte-for-byte match fails.
  const rawBody = await req.text();

  const valid = await verifySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);
  if (!valid) {
    console.warn("Razorpay webhook signature mismatch — rejecting.");
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const eventType = event.event as string;

  if (eventType === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;
    const paymentId = payment?.id;

    if (razorpayOrderId) {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "paid", payment_id: paymentId })
        .eq("razorpay_order_id", razorpayOrderId);

      if (error) console.error("Failed to mark order paid:", error);
    }
  } else if (eventType === "payment.failed") {
    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;

    if (razorpayOrderId) {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("razorpay_order_id", razorpayOrderId);

      if (error) console.error("Failed to mark order failed:", error);
    }
  }
  // Other event types are safely ignored — Razorpay expects a 2xx
  // response for any event it sends, whether or not we act on it.

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
