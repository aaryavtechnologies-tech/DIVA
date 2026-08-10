# PHASE-3-TODO.md — what's left after Phase 2

Phase 1 (schema/security) and Phase 2 (admin panel, now including full
product CRUD) are done in code. Everything below is what's still open,
in the order the next session should tackle it. This doesn't repeat
Phase 1/2 detail — see `PROJECT-STATUS.md` for that.

---

## 0. Before touching any code — go live with what's already built

Nothing in Phase 2 has been run against the real Supabase project yet.
Do this first, in order, or the Products tab will look "broken" for a
reason that has nothing to do with the code:

1. Open the Supabase SQL editor and run the **entire** `supabase/schema.sql`
   again. It's idempotent — safe even though v1/v2 already ran. This is
   what actually creates `public.products` and the `product-images`
   Storage bucket.
2. (Optional) If you want to start from the existing 15-item demo
   catalogue instead of an empty Products tab, uncomment and run the
   seed `insert into public.products (...) values (...)` block near the
   bottom of `schema.sql` — **only once**, it's not idempotent.
3. If you haven't already: create your own Supabase Auth user, then run
   the `insert into public.admins …` snippet at the bottom of
   `schema.sql` with your email so you can actually sign into `/admin`.
4. Sign into `/admin`, open the **Products** tab, and confirm you can
   add, edit, and delete a test product, and that it shows up on
   `products.html` after a refresh.

---

## 1. Phase 3 — Customer auth polish (DONE)

- [x] **`js/auth.js`**: `initAccountMenu()` now populates the account
  dropdown on every storefront page via `getSession()`/`onAuthStateChange`.
  Signed out shows "Sign In / Create Account"; signed in shows "Signed
  in as `<email>` · My Orders · Sign Out". `js/auth.js` is now included
  on every storefront page, not just login/signup/cart. Cart's old
  separate account-bar logic was removed in favor of this shared code.
- [x] **Google OAuth button**: added to `login.html` and `signup.html`,
  using the existing `.btn-google` style and calling the existing
  `signInWithGoogle()`.
- [x] **Google OAuth setup docs**: written into `README.md` under
  "Enable Google Sign-In".
- [x] **"My Orders" page**: new `orders.html` + `js/orders.js`, auth-gated
  like `cart.html`, using the new `fetchMyOrders()` in
  `js/supabase-client.js` (relies on the existing RLS select policy,
  no schema change).

## 2. Phase 4 — Payments
- [x] **Dummy/simulated Razorpay flow**: done — see `PROJECT-STATUS.md`
  Phase 4a. `cart.html` shows a "Processing payment…" → "Payment
  Successful" modal, driven by `runDummyPaymentModal()` in
  `js/checkout.js`. It does not touch `orders.payment_status` (RLS
  blocks that from the browser by design) — the order stays `pending`
  until an admin confirms it, which is the honest, secure behavior.
- [ ] **Real Razorpay wiring** (do this once you have live keys):
  - Supabase Edge Function `create-razorpay-order` — takes an order id,
    calls Razorpay's Orders API server-side with `KEY_SECRET` (never in
    frontend code), returns `razorpay_order_id` + your public `KEY_ID`.
  - Uncomment the Razorpay checkout script tag in `cart.html`.
  - Wire the `// --- Razorpay handoff ---` comment block in
    `checkout.js`'s `initPayment()` to call the edge function and open
    the Razorpay widget.
  - Supabase Edge Function `razorpay-webhook` — verifies Razorpay's
    signature server-side and flips `orders.payment_status` to `'paid'`
    or `'failed'`. This is the part that guarantees no paid order is
    ever missed even if the browser crashes right after paying — never
    trust a browser-side "success" callback alone.

## 3. Phase 5 — Docs (not started)

- [ ] Rewrite `README.md`'s setup section to match what's actually true
  now: running `schema.sql` (v3, with products + storage), creating the
  first admin, the Google OAuth steps from Phase 3 above, and a pointer
  to `/admin` including the new Products tab.
- [ ] `AI-CONTEXT.md` still describes the admin panel and products table
  as "not done yet" — update it to match reality once Phases 3–5 above
  are finished, so the next person (human or AI) isn't re-reading a
  stale plan.

## 4. Smaller loose ends (pick up opportunistically)

- [ ] No image drag-and-drop or multi-image support in the Products
  tab yet — just one image URL / one uploaded file per product. Fine
  for now; revisit if the catalogue needs product galleries later.
- [ ] No bulk actions (bulk hide/delete/reorder) in the Products tab —
  each product is edited one at a time. Add `sort_order` drag-reordering
  if manually typing a number gets annoying.
- [ ] Categories are free-text in the product form (no fixed list/
  dropdown), so a typo creates a new category on the storefront filter
  row. Consider a fixed category dropdown once the catalogue is real.
- [ ] Once real product photos replace the Unsplash placeholders, the
  Content-Security-Policy `img-src` in every HTML `<meta>` tag can be
  tightened (it currently allows `images.unsplash.com` for the demo
  data — the new Supabase Storage bucket domain is already covered by
  the existing `*.supabase.co` allowance).
