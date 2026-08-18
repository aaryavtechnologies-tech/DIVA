/* ============================================================
   DIVA JEWELS — razorpay-webhook
   ------------------------------------------------------------
   This function is called directly by Razorpay's servers when a
   payment is successfully captured (or fails). 
   
   It verifies the cryptographic signature (x-razorpay-signature)
   using your RAZORPAY_WEBHOOK_SECRET to ensure the request is 
   legitimate, then updates the Supabase database to mark the 
   order as 'paid'.

   Deploy:  supabase functions deploy razorpay-webhook --no-verify-jwt
   Secrets: supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_secret
   ============================================================ */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    // We must read the raw body text to verify the HMAC signature
    const bodyText = await req.text();

    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("Missing RAZORPAY_WEBHOOK_SECRET environment variable.");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Verify HMAC-SHA256 signature using Web Crypto API
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
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (expectedSignature !== signature) {
      console.error("Signature mismatch!");
      return new Response("Invalid signature", { status: 400 });
    }

    // Parse the payload now that we know it's safely from Razorpay
    const payload = JSON.parse(bodyText);

    if (payload.event === "payment.captured") {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Update the database order to 'paid'
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: "paid", payment_id: paymentEntity.id })
        .eq("razorpay_order_id", orderId);
        
      if (error) {
        console.error("Database update error:", error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
