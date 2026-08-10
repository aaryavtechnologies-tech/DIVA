# Diva Jewels — Storefront Skeleton

A ready-to-deploy jewelry storefront built with plain HTML, CSS and JavaScript
(no build step, no framework). Cart, checkout, and contact form are wired up
to a Supabase backend skeleton, with Razorpay left as a clearly-marked
placeholder for you to attach your own keys.

## What's included

```
index.html          Home page
products.html        Shop / all products (with category filters)
about.html            Our Story
contact.html          Contact form (writes to Supabase)
cart.html             Cart → delivery address → payment → confirmation
css/style.css         Full design system (cream / gold / white theme)
js/products-data.js   Product catalogue (15 demo items, swap for a live table later)
js/cart.js            localStorage-backed cart engine
js/supabase-client.js Supabase client + createOrder() / submitContactMessage()
js/checkout.js         Cart page logic: address form, validation, payment handoff
js/main.js             Shared UI: nav, product cards, announcement bar, toasts
assets/logo.png        Your DIVA crest, used as the site favicon + header mark
supabase/schema.sql    Orders + contact_messages tables, RLS policies
```

## 1. Run it locally

No build tools needed — it's static HTML. Just serve the folder with any
static server (opening `index.html` directly also works, but a local server
avoids some browser quirks with `fetch`):

```bash
cd diva-jewels
python3 -m http.server 8080
# then open http://localhost:8080
```

Right now the cart and checkout flow work end-to-end in **demo mode** —
orders and contact messages log to the browser console instead of a
database until you connect Supabase (step 2).

## 2. Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run the entire contents of `supabase/schema.sql`.
   This creates:
   - `orders` — one row per checkout, written **before** payment is
     attempted, so no order is ever lost even if the payment fails or the
     customer closes the tab.
   - `contact_messages` — contact form submissions.
   - Row Level Security policies that let the public site **insert only** —
     nobody can read, edit or delete orders from the browser. Reading
     orders back (for your admin panel) requires the `service_role` key,
     which must stay server-side.
3. In `js/supabase-client.js`, replace:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-PUBLIC-KEY";
   ```
   with your project's URL and **anon/public** key (Project Settings → API).
   This key is safe to ship in frontend code — it can only insert rows,
   never read or change existing ones, because of the RLS policies above.

That's it — orders placed through `cart.html` and messages sent through
`contact.html` will now land in your Supabase tables.

## 3. Enable Google Sign-In (optional)

The "Continue with Google" button on `login.html` / `signup.html` calls
`signInWithGoogle()`, which is already wired up in
`js/supabase-client.js` — the only thing left is a one-time setup click-
through in the Google Cloud Console and your Supabase Auth dashboard.
Nothing to build here.

1. **Google Cloud Console**
   - Create (or reuse) a project at [console.cloud.google.com](https://console.cloud.google.com).
   - Go to **APIs & Services → OAuth consent screen** and configure it
     (External user type is fine for a public storefront).
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth
     client ID**, application type **Web application**.
   - Under **Authorized redirect URIs**, add your Supabase project's
     callback URL:
     ```
     https://xpcaxdqhwpvqxtevmors.supabase.co/auth/v1/callback
     ```
   - Save, then copy the generated **Client ID** and **Client Secret**.
2. **Supabase Auth dashboard**
   - In your Supabase project, go to **Authentication → Providers →
     Google**.
   - Toggle it **on**, paste in the **Client ID** and **Client Secret**
     from the step above, and save.
   - Under **Authentication → URL Configuration**, make sure your site's
     URL (and any preview/staging URLs) are listed under **Redirect
     URLs** — Supabase needs this to hand the session back to
     `login.html`/`signup.html`/wherever the user started (the app
     passes this along via `?redirect=`).
3. That's it — no code changes needed. The button will redirect to
   Google, then back to Supabase, then back to this site with the user
   signed in.

## 4. Razorpay (already wired up — just add your keys)

Razorpay is fully integrated via two Supabase Edge Functions in
`supabase/functions/`, so your `KEY_SECRET` never touches frontend code
or Cloudflare. `cart.html` and `js/checkout.js` already call them.

**See [`RAZORPAY-SETUP.md`](RAZORPAY-SETUP.md) for the full step-by-step**
(install Supabase CLI, set secrets, deploy functions, configure the
webhook). Short version:

```bash
supabase link --project-ref xpcaxdqhwpvqxtevmors
supabase secrets set RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook --no-verify-jwt
```

Then add a webhook in the Razorpay dashboard pointing at
`https://xpcaxdqhwpvqxtevmors.supabase.co/functions/v1/razorpay-webhook`
and set `RAZORPAY_WEBHOOK_SECRET` from the value it gives you.

Never trust a payment "success" callback fired only in the browser —
`payment_status` is only ever set to `'paid'` by the signature-verified
`razorpay-webhook` function, never by the customer's browser.

## 5. Build the admin panel

The schema is ready for it: point a separate authenticated app (Supabase
Auth + the `service_role` key, used server-side only) at the `orders` table
to list, search and update `order_status` / `payment_status`. Because the
public site can only *insert* orders, every order placed — paid or not —
will already be sitting there waiting for you, so nothing slips through.

## Security notes

- Content-Security-Policy meta tags restrict scripts/styles/images/connections
  to only the domains this site actually needs (fonts, Unsplash images,
  Supabase, Razorpay).
- All user-provided text is inserted with `textContent`/DOM APIs, never
  `innerHTML`, to avoid XSS.
- The cart only ever stores `{id, qty}` in `localStorage` — prices and names
  are always re-read from the product catalogue at render and checkout time,
  so a tampered localStorage value can't be used to under-pay.
- Address and contact forms are validated both with HTML `required`/pattern
  attributes and in JavaScript before submission.
- Contact and newsletter forms include a honeypot field to deter simple bots.
- Row Level Security on Supabase means the public anon key can create orders
  and messages but never read, edit, or delete them.

## Swapping in real product data

`js/products-data.js` is a plain array — replace it with a `fetch()` call to
a Supabase `products` table whenever you're ready to manage inventory from
the admin panel instead of hand-editing this file.
