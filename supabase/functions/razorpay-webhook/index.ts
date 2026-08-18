/* ============================================================
   DIVA JEWELS — razorpay-webhook (Live Mode Production)
   ------------------------------------------------------------
   Called directly by Razorpay's servers when payment events fire:
   - payment.captured
   - order.paid
   - payment.failed

   Security:
   1. Validates HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET.
   2. Bypasses client RLS via Supabase service_role key to safely
      update payment_status to 'paid' and record payment_id.
   3. Matches orders by razorpay_order_id OR receipt order_number.

   Deploy:  supabase functions deploy razorpay-webhook --no-verify-jwt
   Secrets: supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Constant-time string comparison to mitigate timing attacks */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      console.warn("Webhook received without x-razorpay-signature header.");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const bodyText = await req.text();
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("Critical: RAZORPAY_WEBHOOK_SECRET environment variable is missing.");
      return new Response(JSON.stringify({ error: "Webhook secret not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify HMAC-SHA256 signature using native Web Crypto API
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(bodyText)
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (!constantTimeCompare(expectedSignature.toLowerCase(), signature.toLowerCase())) {
      console.error("Webhook signature mismatch! Rejecting unauthorized payload.");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Payload is verified from Razorpay
    const payload = JSON.parse(bodyText);
    const event = payload.event;
    console.log(`Razorpay webhook verified: event = ${event}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase configuration in edge function.");
      return new Response(JSON.stringify({ error: "Supabase service role not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id || "captured";
      const orderNumber = paymentEntity?.notes?.order_number || paymentEntity?.notes?.orderNumber;

      console.log(`Processing successful payment: paymentId=${paymentId}, rzpOrderId=${razorpayOrderId}, orderNumber=${orderNumber}`);

      let updateQuery = supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_id: paymentId,
          order_status: "received"
        });

      if (razorpayOrderId) {
        updateQuery = updateQuery.eq("razorpay_order_id", razorpayOrderId);
      } else if (orderNumber) {
        updateQuery = updateQuery.eq("order_number", orderNumber);
      } else {
        console.warn("Could not determine order identifier from payload:", payload);
        return new Response(JSON.stringify({ status: "ignored_missing_order_id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      }

      const { data, error } = await updateQuery.select();

      if (error) {
        console.error("Database update error on webhook capture:", error);
        throw error;
      }

      console.log(`Order updated to paid successfully:`, data);
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const failureReason = paymentEntity?.error_description || "Payment failed";

      console.warn(`Payment failed event for rzpOrderId=${razorpayOrderId}: ${failureReason}`);
      // Only set to failed if order is not already paid
      if (razorpayOrderId) {
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("razorpay_order_id", razorpayOrderId)
          .neq("payment_status", "paid");
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (err: any) {
    console.error("Webhook processing exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Webhook processing failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });
  }
});
