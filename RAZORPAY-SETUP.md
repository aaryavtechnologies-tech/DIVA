# Razorpay Live Mode Setup Guide — Diva Jewels

Your Razorpay `KEY_SECRET` never lives in frontend code, Git, or Cloudflare Pages.
It lives strictly inside your Supabase Edge Functions:

```
supabase/functions/_shared/cors.ts             CORS locked to production domains & preview URLs
supabase/functions/create-razorpay-order/      Creates Razorpay order server-side with live keys
supabase/functions/razorpay-webhook/           Validates cryptographic signatures, marks orders "paid"
```

**Cloudflare Pages needs ZERO environment variables for this project.**
Supabase URL & anon key are in `js/supabase-client.js` (safe — protected by Row Level Security).
Razorpay's public Live Key ID is returned dynamically by the Edge Function on checkout.

---

## 🚀 Live Mode Step-by-Step Setup

### Step 1: Login to Supabase CLI & Link Project
In your project terminal (`d:\DIVA`):
```bash
supabase login
supabase link --project-ref xpcaxdqhwpvqxtevmors
```

---

### Step 2: Get Your Live Keys from Razorpay Dashboard
1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Toggle the switch at top-left/top-bar from **Test Mode** to **Live Mode**.
3. Go to **Account & Settings → API Keys**.
4. Click **Generate Live Key** (or copy existing):
   - **Key ID**: Starts with `rzp_live_...`
   - **Key Secret**: Save this immediately (Razorpay only shows it once).

---

### Step 3: Set Secrets in Supabase
Set the live keys directly into your Supabase Edge Functions environment:
```bash
supabase secrets set RAZORPAY_KEY_ID="rzp_live_your_key_id_here"
supabase secrets set RAZORPAY_KEY_SECRET="your_live_key_secret_here"
```

---

### Step 4: Configure Live Webhook in Razorpay
1. In Razorpay Dashboard (still in **Live Mode**):
2. Go to **Account & Settings → Webhooks → Add New Webhook**.
3. **Webhook URL**:
   ```
   https://xpcaxdqhwpvqxtevmors.supabase.co/functions/v1/razorpay-webhook
   ```
4. **Secret**: Enter a secure passphrase (e.g. `diva_live_whsec_98327498`).
5. **Active Events**: Check:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`
6. Click **Save**.

Now set this webhook secret in Supabase:
```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET="diva_live_whsec_98327498"
```

---

### Step 5: Deploy Edge Functions
Deploy both functions to production:
```bash
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook --no-verify-jwt
```
*(Note: `--no-verify-jwt` is required on the webhook because Razorpay's servers authenticate directly via HMAC signature header `x-razorpay-signature`, not Supabase user tokens).*

---

### Step 6: Verify Live Payment
1. Visit your live store or local site (`index.html` or `cart.html`).
2. Add an item, enter shipping details, and proceed to payment.
3. The Razorpay live checkout modal will pop up in INR with UPI (GPay, PhonePe, Paytm, BHIM), Net Banking, Cards, and Wallets enabled.
4. When payment succeeds:
   - Frontend immediately transitions to the confirmed order screen with the payment reference ID.
   - The Razorpay webhook receives the event, verifies the signature, and updates `payment_status = 'paid'` and `payment_id` on the database row.
   - The customer can see the order under **My Orders** (`orders.html`).
   - The store admin sees the order marked as **Paid** in the **Admin Dashboard** (`admin/dashboard.html`).

---

## 🔒 Security Architecture Highlights

- **Anti-Tamper Pricing**: Amount is fetched from the database on the server, not trusted from client-side requests.
- **Timing-Safe HMAC Verification**: Constant-time comparison ensures webhooks cannot be forged or timing-attacked.
- **CORS Protection**: Restricted to `divajewels.shop`, `www.divajewels.shop`, authorized preview domains, and localhost.
- **Zero Frontend Leakage**: Key secrets never exist in HTML, JS, or client-accessible locations.
