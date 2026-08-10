/* ============================================================
   DIVA JEWELS — create-razorpay-order
   ------------------------------------------------------------
   Called from cart.html right after the order row is inserted into
   Supabase (payment_status = 'pending'). This function:

   1. Locks down CORS to https://divajewels.shop only (see _shared/cors.ts).
   2. Re-reads the order from the DATABASE using the service_role key —
      never trusts an amount the browser sends — so a tampered request
      can't create a Razorpay order for less than the real total.
   3. Calls Razorpay's Orders API using RAZORPAY_KEY_ID / KEY_SECRET,
      which live only in this function's environment (set via
      `supabase secrets set`), never in frontend code or Cloudflare.
   4. Saves the razorpay_order_id back onto the order row.
   5. Returns only what the browser needs to open Razorpay Checkout:
      { razorpayOrderId, keyId, amount, currency }. KEY_SECRET never
      leaves this function.

   Deploy:  supabase functions deploy create-razorpay-order
   Secrets: supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=...
   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
   by the Supabase platform — you never set those yourself.)
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, buildCorsHeaders } from "../_shared/cors.ts";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse; // preflight or blocked-origin — already handled

  const headers = { ...buildCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets.");
    return new Response(JSON.stringify({ error: "Payments are not configured yet." }), { status: 500, headers });
  }

  let body: { orderNumber?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const orderNumber = body.orderNumber?.trim();
  if (!orderNumber) {
    return new Response(JSON.stringify({ error: "orderNumber is required" }), { status: 400, headers });
  }

  // service_role client — bypasses RLS deliberately, this is trusted
  // server code, not a browser request.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, order_number, total, payment_status, razorpay_order_id")
    .eq("order_number", orderNumber)
    .single();

  if (fetchError || !order) {
    return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers });
  }

  if (order.payment_status === "paid") {
    return new Response(JSON.stringify({ error: "This order is already paid" }), { status: 409, headers });
  }

  // Idempotency: if a Razorpay order was already created for this row
  // (e.g. the customer refreshed mid-checkout), reuse it instead of
  // creating a duplicate order on Razorpay's side.
  if (order.razorpay_order_id) {
    return new Response(
      JSON.stringify({
        razorpayOrderId: order.razorpay_order_id,
        keyId: RAZORPAY_KEY_ID,
        amount: Math.round(Number(order.total) * 100),
        currency: "INR",
      }),
      { status: 200, headers }
    );
  }

  // Amount comes from the DATABASE row, never from the request body —
  // this is what stops a tampered client from paying less than the
  // real total.
  const amountPaise = Math.round(Number(order.total) * 100);

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
      notes: { order_id: order.id, order_number: order.order_number },
    }),
  });

  if (!rzpResponse.ok) {
    const errText = await rzpResponse.text();
    console.error("Razorpay order creation failed:", errText);
    return new Response(JSON.stringify({ error: "Could not start payment. Please try again." }), { status: 502, headers });
  }

  const rzpOrder = await rzpResponse.json();

  const { error: updateError } = await supabase
    .from("orders")
    .update({ razorpay_order_id: rzpOrder.id })
    .eq("id", order.id);

  if (updateError) {
    console.error("Failed to save razorpay_order_id:", updateError);
    // Not fatal to the checkout flow — the webhook can still match on
    // receipt/order_number if this write failed — but log it loudly.
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
