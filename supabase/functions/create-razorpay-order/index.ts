/* ============================================================
   DIVA JEWELS — create-razorpay-order (Live Mode Production)
   ------------------------------------------------------------
   Called from cart.html when customer proceeds to pay.

   Security:
   1. Locked down CORS (see _shared/cors.ts).
   2. Amount is ALWAYS read from the Supabase database using
      service_role client — never trusted from client request body.
   3. RAZORPAY_KEY_SECRET is kept strictly server-side in Edge Function.
   4. Idempotency: reuses existing razorpay_order_id if already generated.

   Deploy:  supabase functions deploy create-razorpay-order
   Secrets: supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=...
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, buildCorsHeaders } from "../_shared/cors.ts";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse; // preflight or disallowed-origin

  const headers = {
    ...buildCorsHeaders(req.headers.get("origin")),
    "Content-Type": "application/json"
  };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers
    });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in Supabase secrets.");
    return new Response(
      JSON.stringify({ error: "Payment gateway is not configured yet on the server." }),
      { status: 500, headers }
    );
  }

  let body: { orderNumber?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request body" }), {
      status: 400,
      headers
    });
  }

  const orderNumber = body.orderNumber?.trim();
  if (!orderNumber) {
    return new Response(JSON.stringify({ error: "orderNumber is required" }), {
      status: 400,
      headers
    });
  }

  // Trusted server client using service_role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, order_number, total, payment_status, razorpay_order_id")
    .eq("order_number", orderNumber)
    .single();

  if (fetchError || !order) {
    console.error("Order lookup failed:", fetchError);
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers
    });
  }

  if (order.payment_status === "paid") {
    return new Response(JSON.stringify({ error: "This order has already been paid." }), {
      status: 409,
      headers
    });
  }

  const amountPaise = Math.round(Number(order.total) * 100);
  if (isNaN(amountPaise) || amountPaise <= 0) {
    return new Response(JSON.stringify({ error: "Invalid order amount." }), {
      status: 400,
      headers
    });
  }

  // Idempotent reuse of existing Razorpay order id if already created
  if (order.razorpay_order_id) {
    return new Response(
      JSON.stringify({
        razorpayOrderId: order.razorpay_order_id,
        keyId: RAZORPAY_KEY_ID,
        amount: amountPaise,
        currency: "INR",
      }),
      { status: 200, headers }
    );
  }

  // Call Razorpay API to generate live/test order
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: order.order_number,
      notes: {
        order_id: order.id,
        order_number: order.order_number
      },
    }),
  });

  if (!rzpResponse.ok) {
    const errText = await rzpResponse.text();
    console.error("Razorpay order creation error:", errText);
    return new Response(
      JSON.stringify({ error: "Could not initiate payment session with Razorpay." }),
      { status: 502, headers }
    );
  }

  const rzpOrder = await rzpResponse.json();

  // Save the Razorpay order ID to the order row
  const { error: updateError } = await supabase
    .from("orders")
    .update({ razorpay_order_id: rzpOrder.id })
    .eq("id", order.id);

  if (updateError) {
    console.warn("Failed to persist razorpay_order_id to DB:", updateError);
  }

  return new Response(
    JSON.stringify({
      razorpayOrderId: rzpOrder.id,
      keyId: RAZORPAY_KEY_ID,
      amount: amountPaise,
      currency: "INR",
    }),
    { status: 200, headers }
  );
});
