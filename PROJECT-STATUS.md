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

## 🚧 Phase 3 — Customer auth polish (IN PROGRESS)
- ✅ Account/profile icon markup added to the header of **every**
  storefront page (`index.html`, `products.html`, `about.html`,
  `contact.html`, `cart.html`, `login.html`, `signup.html`) —
  `[data-account-menu]` / `[data-account-trigger]` / `[data-account-dropdown]`.
- ✅ `js/supabase-client.js` extended with `signInWithGoogle()`,
  `sendPasswordReset()`, `updatePassword()`; `createOrder()` now attaches
  `user_id` when a customer is signed in.
- ⬜ **Not yet done:** the JS that actually populates the account
  dropdown (`js/auth.js`) — right now the icon renders but is inert. Next
  step: wire it to `getCurrentUser()` so it shows "Sign In / Create
  Account" when signed out, and "Signed in as x · My Orders · Sign Out"
  when signed in, on every page (not just the cart's existing account
  bar).
- ⬜ Google OAuth **button** on `login.html` / `signup.html` (the backend
  function `signInWithGoogle()` exists; no UI button calls it yet).
- ⬜ Google OAuth **Supabase/Google Cloud Console setup guide** — not yet
  written into `README.md`.
- ✅ Checkout auth-gate already existed pre-build (`cart.html` redirects
  to `login.html?redirect=cart.html` if not signed in) and still applies —
  satisfies "check login before payment."

## ⬜ Phase 4 — Payments (NOT STARTED THIS SESSION)
- Dummy/simulated Razorpay flow on the client (a fake "Processing
  payment…" modal before confirmation) — not yet built. Currently
  `checkout.js` just skips straight to the confirmation screen when the
  real Razorpay SDK isn't present, which still works but isn't a visual
  "payment" moment.
- Real Razorpay wiring (Edge Functions for order creation + webhook) is
  still intentionally deferred, per your instructions — key secret must
  never live in frontend code.

## ⬜ Phase 5 — Docs (NOT STARTED THIS SESSION)
- `README.md` / `AI-CONTEXT.md` need updating with: how to run
  `schema.sql`, how to create the first admin, the Google OAuth setup
  steps, and a pointer to `/admin`.

---

### Next session should start at Phase 3 (finish `js/auth.js` +
Google button UI), then Phase 4 (dummy payment modal), then Phase 5
(docs), in that order. See **`PHASE-3-TODO.md`** for the detailed,
step-by-step checklist of everything left across Phases 3–5.
