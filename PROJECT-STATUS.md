# PROJECT-STATUS.md — Diva Jewels Admin Panel + Auth Build

Read this before making any changes. It tracks phases so whoever
(human or AI) picks this up next doesn't have to re-derive context.

**Supabase project:** `xpcaxdqhwpvqxtevmors` — URL + anon key are already
wired into `js/supabase-client.js`.

---

## ✅ Phase 1 — Schema + security (DONE)
`supabase/schema.sql` rewritten (v2):
- `orders.user_id` added (FK → `auth.users`), so a customer's own orders
  can be linked to their account.
- `order_status` enum extended: `received → processing → shipped →
  out_for_delivery → delivered` (+ `cancelled`). Maps to "ongoing" (received/
  processing), "on route" (shipped/out_for_delivery), "delivered".
- New `admins` table — an allow-list of `auth.users.id`s. **No public
  signup path** — rows are added by hand in the SQL editor (snippet is at
  the bottom of `schema.sql`).
- New `public.is_admin()` security-definer function, used by RLS so
  policies can check admin status without recursive RLS issues.
- RLS policies (high security, deny-by-default):
  - `orders`: anon/authenticated can **insert only**. Authenticated
    customers can **select their own** orders (`user_id = auth.uid()`).
    Admins can **select + update all** orders. Nobody can delete.
  - `contact_messages`: anon/authenticated can **insert only**. Admins can
    **select all**. Nobody can update/delete.
  - `admins`: a user can **select their own row only** (used to confirm
    admin access client-side after login). No insert/update/delete from
    the browser at all.
- **⚠️ Not yet run against the live Supabase project** — this needs to be
  pasted into the Supabase SQL editor and executed. It's idempotent, safe
  to run even if the v1 schema is already live.
- **⚠️ No admin exists yet.** After running the schema, create a normal
  Supabase Auth user for yourself (Supabase Studio → Authentication → Add
  user, or sign up through `signup.html`), then run the `insert into
  public.admins …` snippet at the bottom of `schema.sql` with that email.

## ✅ Phase 2 — Admin panel + full product control (DONE, needs live testing)
New `/admin` folder, fully separate from the storefront's anon-only flow:
- `admin/login.html` — email+password only, **no signup**, "Forgot
  password?" reveals an inline reset-request form. Premium dark/gold
  styling consistent with the storefront's cream/gold/ink design system.
- `admin/reset-password.html` — where the password-reset email link
  lands; sets a new password via `auth.updateUser()`.
- `admin/dashboard.html` + `admin/js/admin-app.js` — sidebar-nav
  dashboard with:
  - **Orders panel**: every order (paid or not), searchable, with a
    per-row dropdown to update `order_status` live against Supabase (RLS
    enforces this only works for a signed-in admin). Payment status shown
    as a read-only badge (flips to "paid" only once Razorpay + the
    webhook are wired — see Phase 4).
  - **Inquiries panel**: read-only list of `contact_messages` submissions.
  - **Products panel (new)**: full CRUD over the live catalogue —
    add a product, edit any existing product's name/category/price/
    compare-at/description/visibility, replace its image (paste a URL
    or upload a file straight to Supabase Storage), or delete it
    outright. Nothing here is a mock — every action writes straight to
    `public.products` and the storefront reflects it on next page load.
  - Stat cards (total orders, awaiting payment, in transit, delivered).
- Access control: `admin/js/admin-client.js` uses the **same anon key**
  as the storefront (never `service_role` in the browser). After sign-in
  it checks `public.admins` for the session's `user.id`; if absent, it
  force-signs-out and bounces back to `login.html`. This is enforced
  twice — once client-side for UX, once by RLS server-side for real
  security (a non-admin session simply gets zero rows back even if they
  bypass the client check). The exact same pattern (`public.is_admin()`
  in RLS) now also gates every write to `public.products`.
- **`supabase/schema.sql` (v3)** adds:
  - `public.products` table (name, category, price, compare_at,
    image_url, description, active, sort_order) with RLS: public/
    anon can `select` only `active = true` rows; admins get full
    `select`/`insert`/`update`/`delete`.
  - A public `product-images` Storage bucket + policies: anyone can
    view, only admins can upload/replace/delete.
  - A commented-out one-time seed block that migrates the 15 demo
    items from `js/products-data.js` into the real table, if you want
    to start from the existing catalogue instead of empty.
- **Storefront refactor**: `js/products-data.js` now fetches the live
  catalogue from `public.products` (via the new `fetchProducts()` in
  `js/supabase-client.js`) and falls back to the old hardcoded demo
  array only if Supabase isn't configured or the table is empty.
  `js/main.js` and `js/checkout.js` now `await window.PRODUCTS_READY`
  before rendering, so prices/images are never stale. Script tag order
  changed on every storefront page (`supabase-client.js` now loads
  *before* `products-data.js`) — don't reorder them back.
- **⚠️ Needs an admin user + the v3 schema live** (run `schema.sql`
  again — it's idempotent) **to actually sign in and manage products.**
  Until then the storefront quietly keeps using the demo catalogue.

## ✅ Phase 3 — Customer auth polish (DONE)
- ✅ Account/profile icon markup added to the header of **every**
  storefront page (`index.html`, `products.html`, `about.html`,
  `contact.html`, `cart.html`, `login.html`, `signup.html`, and the new
  `orders.html`) — `[data-account-menu]` / `[data-account-trigger]` /
  `[data-account-dropdown]`.
- ✅ `js/supabase-client.js` extended with `signInWithGoogle()`,
  `sendPasswordReset()`, `updatePassword()`, and now `fetchMyOrders()`;
  `createOrder()` attaches `user_id` when a customer is signed in.
- ✅ `js/auth.js` now populates the account dropdown on every storefront
  page (`initAccountMenu()`): signed out shows "Sign In / Create
  Account", signed in shows "Signed in as `<email>` · My Orders · Sign
  Out". `js/auth.js` is now included on `index.html`, `products.html`,
  `about.html`, and `contact.html` too (previously only on
  `login.html`/`signup.html`/`cart.html`). Cart's old separate
  `[data-account-bar]` bar was removed — it's the same shared dropdown
  now, not duplicated.
- ✅ Google OAuth **button** ("Continue with Google") added to
  `login.html` and `signup.html`, styled with the existing `.btn-google`
  class, calling the existing `signInWithGoogle()`.
- ✅ Google OAuth **Supabase/Google Cloud Console setup guide** written
  into `README.md` (new "Enable Google Sign-In" section) — Client ID/
  secret, the Supabase callback redirect URI, and enabling the provider
  in the Supabase dashboard.
- ✅ **"My Orders" page** — new `orders.html` + `js/orders.js`. Auth-gated
  like `cart.html` (redirects to `login.html?redirect=orders.html` if
  signed out). Lists the signed-in customer's own orders via the new
  `fetchMyOrders()`, which relies entirely on the existing RLS select
  policy (`orders.user_id = auth.uid()`) — no schema change needed.
  Includes status filter pills (All / Ongoing / On Route / Delivered /
  Cancelled, matching the admin panel's grouping) and a "Reorder"
  button per order that adds its items back to the cart.
- ✅ Checkout auth-gate already existed pre-build (`cart.html` redirects
  to `login.html?redirect=cart.html` if not signed in) and still applies —
  satisfies "check login before payment."

## ✅ Phase 4a — Dummy/simulated Razorpay flow (DONE)
- `cart.html` now has a demo payment modal (`[data-payment-modal]`) —
  "Processing payment…" with a spinner, then a checkmark "Payment
  Successful" state, before advancing to the confirmation step.
- `js/checkout.js`'s `runDummyPaymentModal()` drives it; only runs when
  `typeof Razorpay === "undefined"` (i.e. no live Razorpay key yet).
- **Deliberately does NOT flip `orders.payment_status` in the database.**
  RLS only allows admins to update orders (see `schema.sql`), so a
  customer's browser couldn't do this even if it tried — and once real
  Razorpay is wired up, `payment_status` must only ever be set by the
  signature-verified webhook, never client-side. The order sits as
  `pending` until an admin confirms it (or the future webhook does).
  The confirmation screen's copy is honest about this ("saved and
  waiting on an admin to confirm it").
- The confirmation screen now also shows a "Store admin? Sign in to
  manage this order →" link to `admin/login.html`, revealed only after
  a (simulated) successful payment.
- Real Razorpay wiring (Edge Functions for order creation + webhook) is
  still intentionally deferred — key secret must never live in frontend
  code.

## ⬜ Phase 4b — Real Razorpay wiring (NOT STARTED)

## ⬜ Phase 5 — Docs (NOT STARTED THIS SESSION)
- `README.md` / `AI-CONTEXT.md` need updating with: how to run
  `schema.sql`, how to create the first admin, the Google OAuth setup
  steps, and a pointer to `/admin`.

---

### Next session should start at Phase 4 (dummy payment modal, then
real Razorpay wiring), then Phase 5 (docs), in that order. See
**`PHASE-3-TODO.md`** for the detailed, step-by-step checklist of
everything left across Phases 4–5 (its Phase 3 section is now done).
