# AI-CONTEXT.md — Diva Jewels build notes

Read this first before making changes. It's a running log of what's been
built, what's stubbed/demo-only, and what's left — written for whichever
AI (or human) picks this up next.

## Stack
Plain HTML/CSS/vanilla JS (no build step, no framework). Supabase for
backend (Postgres + Auth). Razorpay for payment (not wired up yet).
Product images currently point at Unsplash URLs — not real product photos.

## What exists today

- **Storefront pages**: `index.html`, `products.html`, `about.html`,
  `contact.html`, `cart.html` — all static/demo, styled from
  `css/style.css`.
- **Products**: hardcoded in `js/products-data.js` as a `PRODUCTS` array
  (id, name, category, price, compareAt, image, description). Not in
  Supabase yet — see "Product Edit tab" below, this is the big one.
- **Cart**: `js/cart.js`, localStorage-based, id+qty only (price/name
  always re-read from `PRODUCTS` at render time so a tampered
  localStorage value can't under-charge).
- **Checkout**: `js/checkout.js` on `cart.html` — 4-step flow (bag →
  address → payment → confirmation). Saves the order to Supabase
  `orders` table via `js/supabase-client.js` BEFORE payment is attempted
  (so nothing is lost if payment fails/tab closes). Razorpay itself is
  **not connected** — see `checkout.js` comments and README.md; needs a
  Supabase Edge Function to create the Razorpay order server-side
  (KEY_SECRET must never live in frontend code) and a webhook to confirm
  payment.
- **Contact form**: `contact.html` → `submitContactMessage()` →
  Supabase `contact_messages` table.
- **Auth (just added)**: `login.html`, `signup.html`, `js/auth.js`,
  plus auth functions in `js/supabase-client.js`
  (`signUpWithPassword`, `signInWithPassword`, `signOut`,
  `getCurrentUser`). Supabase email/password auth, session handled by
  the Supabase JS SDK (localStorage under the hood).
  - `cart.html` is auth-gated: on load it checks `auth.getSession()`.
    No session → redirect to `login.html?redirect=cart.html`. Signed in
    → shows an account bar ("Signed in as x · Sign out") and reveals
    the cart content (it's hidden behind `[data-cart-authgate]` until
    the check resolves, to avoid a flash of cart content pre-redirect).
  - `login.html` has a "Create an account" link to `signup.html`, and
    vice versa — both preserve `?redirect=` so the user lands back on
    `cart.html` (or wherever) after auth.
  - **Only `cart.html` is gated.** Home/products/about/contact are still
    fully public. If the requirement becomes "browsing requires login
    too," that's a different, bigger change (redirect guard on every
    page, or a global nav-level auth state).
  - If Supabase isn't configured yet (`SUPABASE_URL`/`SUPABASE_ANON_KEY`
    still placeholders in `js/supabase-client.js`), the cart gate is
    skipped entirely (`getSupabaseClient()` returns null) so the demo
    flow stays usable without a live backend.
- **Supabase schema**: `supabase/schema.sql` — `orders` and
  `contact_messages` tables with RLS: the public `anon` key can only
  INSERT into either, never read/update/delete. There is **no
  `products` table yet** and **no admin-facing tables/policies yet** —
  both needed for the admin panel below.

## Not done yet / next up

### 1. Admin panel (biggest remaining piece)
Needs to be a separate authenticated app/section — not part of the
public storefront's anon-key flow, since it needs to *read* orders,
messages, and manage products, which the current RLS policies
deliberately block for the public key. Requirements as given:

- **Orders tab** — list/view orders from the `orders` table (status,
  customer, items, totals), and let the admin update `order_status`
  (received/processing/shipped/delivered/cancelled) and probably
  `payment_status`.
- **Product Edit tab** — full CRUD on products: edit an existing
  product's image, title, and price; add new products; delete
  products. This requires:
  - A new `products` table in Supabase (schema.sql doesn't have one —
    the current catalogue is just a hardcoded JS array). Needs to hold
    at least: id, name, category, price, compareAt, image (URL or
    Supabase Storage path), description, maybe an `active`/visibility
    flag.
  - A Supabase Storage bucket for product images if the admin should be
    able to upload images (not just paste a URL).
  - The storefront (`js/products-data.js` + `main.js`'s
    `buildProductCard`, `renderFeatured`, `renderProductsPage`) needs
    to switch from the static `PRODUCTS` array to fetching from this
    new `products` table. This is a real refactor, not additive — plan
    for it before starting.
- **Inquiry tab** — list/view submissions from `contact_messages`.
- **Admin auth**: needs its own login, and a way to distinguish "admin"
  from "regular customer" (e.g. a `role` column / Supabase custom
  claim, or a separate `admins` table checked via RLS policy /
  Postgres function) — the customer auth added in this session
  (`login.html`/`signup.html`) is NOT admin auth, it's just "can you
  check out." Do not reuse it as-is for admin access control.
  - Simplest path: admin panel as its own page(s) using the
    `service_role` key **only from a trusted server context** (Supabase
    Edge Function or similar) — never ship `service_role` in frontend
    JS. Alternative: authenticated RLS policies scoped to a specific
    admin user id/role, callable from the browser with the user's own
    session.

### 2. Payments
Razorpay is stubbed — see comments in `js/checkout.js` and
`js/supabase-client.js`. Needs: a Supabase Edge Function to create the
Razorpay order (server-side KEY_SECRET), a webhook to verify payment
and flip `orders.payment_status`, and the actual
`checkout.razorpay.com/v1/checkout.js` script wired into `cart.html`
(currently commented out).

### 3. Supabase project setup (not done — placeholders in code)
`js/supabase-client.js` still has `SUPABASE_URL` /
`SUPABASE_ANON_KEY` as placeholders. Until a real project is created
and `supabase/schema.sql` is run against it, orders/contact/auth all
fall back to a local "demo mode" (console-logged, not persisted).
Auth email templates/confirmation settings also need deciding
(confirmation-required vs instant sign-in — `signUpWithPassword`
already handles both, see `needsEmailConfirm` in its return value).

### 4. Smaller loose ends
- No "forgot password" flow yet on `login.html`.
- No global signed-in state in the header on non-cart pages (e.g. no
  "Hi, X" or account link on `index.html`/`products.html`) — only
  `cart.html` shows the account bar right now.
- Orders aren't yet linked to a `user_id` — `orders` table has no FK to
  `auth.users`. Worth adding once the admin panel needs "this
  customer's order history."
