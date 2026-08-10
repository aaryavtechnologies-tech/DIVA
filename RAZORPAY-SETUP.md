# Razorpay via Supabase Edge Functions — Setup Guide

Your Razorpay `KEY_SECRET` never lives in frontend code or in Cloudflare.
It lives only inside two Supabase Edge Functions in this project:

```
supabase/functions/_shared/cors.ts             CORS locked to divajewels.shop
supabase/functions/create-razorpay-order/      Creates a Razorpay order server-side
supabase/functions/razorpay-webhook/           Verifies payment, marks orders "paid"
```

**Cloudflare Pages needs ZERO environment variables for this project.**
Supabase URL/anon key are already hardcoded in `js/supabase-client.js`
(safe — protected by Row Level Security). Razorpay's public Key ID is
fetched live from the edge function on every checkout, so it's never
hardcoded anywhere in the frontend either.

---

## 1. One-time: install the Supabase CLI

```bash
npm install -g supabase
supabase login
```

## 2. Link this project to your Supabase project

```bash
cd DIVA
supabase link --project-ref xpcaxdqhwpvqxtevmors
```

(`xpcaxdqhwpvqxtevmors` is your project ref — already visible in your
Supabase URL in `js/supabase-client.js`.)

## 3. Get your Razorpay keys

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. **Settings → API Keys** → Generate/copy:
   - `Key Id` (starts `rzp_test_` or `rzp_live_`)
   - `Key Secret`

## 4. Set the secrets (never committed to Git, never in Cloudflare)

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret_here
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
by Supabase into every Edge Function — you never set those yourself.

## 5. Deploy the functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required because Razorpay's servers
call it directly with no Supabase session — the webhook authenticates
the caller itself via signature verification (step 6), not via a JWT.

## 6. Create the Razorpay webhook (this is what marks orders "paid")

1. In Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**
2. **Webhook URL:**
   ```
   https://xpcaxdqhwpvqxtevmors.supabase.co/functions/v1/razorpay-webhook
   ```
3. **Active events:** check `payment.captured` and `payment.failed`
4. Razorpay will generate a **Webhook Secret** — copy it, then run:
   ```bash
   supabase secrets set RAZORPAY_WEBHOOK_SECRET=whsec_generated_value
   ```
5. Save the webhook in Razorpay.

**This webhook is what guarantees no paid order is ever missed** — it
fires from Razorpay's own servers independent of the customer's browser,
even if their tab crashes right after paying.

## 7. Test it

1. Keep Razorpay in **Test Mode** (toggle in the dashboard) while testing.
2. Run the site locally or on a preview deploy, add an item to cart, check out.
3. On the Razorpay checkout widget, use a test card:
   - Card: `4111 1111 1111 1111`, any future expiry, any CVC
4. After paying, check your Supabase `orders` table — `payment_status`
   should flip to `paid` and `payment_id` should be filled in (this
   confirms the webhook fired and was verified).

## 8. Go live

1. Switch Razorpay to **Live Mode**, generate live API keys.
2. Re-run step 4 with your **live** `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
3. Create a **second webhook** in Live Mode pointing at the same URL
   (Test and Live mode webhooks are configured separately in Razorpay),
   and set `RAZORPAY_WEBHOOK_SECRET` to the live webhook's secret.
4. No frontend or Cloudflare changes needed — the edge function always
   serves whichever `RAZORPAY_KEY_ID` is currently set as a secret.

---

## Security notes — what's locked down and why

- **CORS**: `supabase/functions/_shared/cors.ts` only allows requests from
  `https://divajewels.shop` and `https://www.divajewels.shop`. A request
  from any other origin (including someone copying your API calls into
  their own site) gets a `403` before your handler code even runs. To add
  a staging domain, add it to the `ALLOWED_ORIGINS` array in that file —
  don't switch to reflecting the request's `Origin` header, which would
  defeat the allowlist entirely.
- **Amount tampering**: `create-razorpay-order` re-reads the order total
  from the database using the service_role key — it never trusts an
  amount sent from the browser. A modified request can't pay less than
  the real total.
- **Payment confirmation**: only `razorpay-webhook` can set
  `payment_status = 'paid'`, and only after verifying Razorpay's HMAC
  signature on the raw request body. The browser's "payment success"
  callback in `checkout.js` only updates the UI — it cannot and does not
  write to the database (RLS blocks customers from updating orders; see
  `supabase/schema.sql`).
- **Idempotency**: if `create-razorpay-order` is called twice for the same
  order (e.g. the customer refreshes mid-checkout), it reuses the existing
  `razorpay_order_id` instead of creating a duplicate order on Razorpay.
- **Secrets never touch Cloudflare**: `RAZORPAY_KEY_SECRET` and
  `RAZORPAY_WEBHOOK_SECRET` exist only as Supabase Edge Function secrets
  (`supabase secrets set ...`), which are encrypted at rest and only
  readable by your deployed functions — never by the frontend, never by
  Cloudflare Pages build config, never committed to Git.

## Updating your domain

If `divajewels.shop` isn't your final domain yet, update it in **one
place**: `supabase/functions/_shared/cors.ts` → `ALLOWED_ORIGINS`, then
redeploy both functions (`supabase functions deploy create-razorpay-order`
and `... razorpay-webhook`).
