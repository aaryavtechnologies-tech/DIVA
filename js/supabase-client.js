/* ============================================================
   DIVA JEWELS — Supabase client (skeleton)
   ------------------------------------------------------------
   1. Create a Supabase project.
   2. Run supabase/schema.sql in the SQL editor.
   3. Paste your Project URL + anon (public) key below.
      The anon key is SAFE to ship in frontend code as long as
      Row Level Security policies from schema.sql are applied —
      it can only INSERT orders/messages, never read, edit or
      delete them. Admin access must go through the service_role
      key from a trusted admin panel/server, never from this file.
   4. Payment capture (Razorpay) must be finished server-side —
      see the note in checkout.js and README.md. This file only
      writes the order to Supabase so it is never lost, even if
      the browser is closed before payment completes.
   ============================================================ */

const SUPABASE_URL = "https://xpcaxdqhwpvqxtevmors.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwY2F4ZHFod3B2cXh0ZXZtb3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzkyMTQsImV4cCI6MjEwMTkxNTIxNH0.Yc4U2W-UE23UhwHbn3N8gIJj-ZA-GzK45sSStSs1rV0";

// Exposed so admin/js/admin-client.js can build its own client against the
// same project without duplicating the URL/key in a second place. Edge
// Functions (create-razorpay-order, razorpay-webhook) live under this same
// project at /functions/v1/<name> — derived here so there's only one place
// that ever needs to know the project URL.
window.DivaConfig = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  EDGE_FUNCTIONS_URL: `${SUPABASE_URL}/functions/v1`
};

let supabaseClient = null;

function getSupabaseClient(){
  if(supabaseClient) return supabaseClient;
  if(typeof window.supabase === "undefined"){
    console.warn("Supabase JS SDK not loaded — check the <script> tag for @supabase/supabase-js.");
    return null;
  }
  if(SUPABASE_URL.includes("YOUR-PROJECT-REF") || SUPABASE_ANON_KEY.includes("YOUR-SUPABASE")){
    console.warn("Supabase is not configured yet. Add your project URL + anon key in js/supabase-client.js.");
    return null;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

/** Generates a human-friendly, collision-resistant order number, e.g. DJ-8F3K2Q1A */
function generateOrderNumber(){
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DJ-${stamp}-${rand}`;
}

/**
 * Persists an order BEFORE payment is attempted, with payment_status = 'pending'.
 * This is the "never miss an order" safeguard: the row exists the moment the
 * customer submits their address, independent of whether Razorpay succeeds,
 * fails, or the tab is closed mid-payment. A Supabase Edge Function + Razorpay
 * webhook should later flip payment_status to 'paid' or 'failed' server-side.
 *
 * @param {object} order - { customer, items, subtotal, shipping, total }
 * @returns {Promise<{ok: boolean, orderNumber?: string, id?: string, error?: string}>}
 */
async function createOrder(order){
  const client = getSupabaseClient();
  const orderNumber = generateOrderNumber();

  let userId = null;
  if(client){
    const { data } = await client.auth.getUser();
    userId = data?.user?.id || null;
  }

  const payload = {
    order_number: orderNumber,
    user_id: userId,
    customer_name: order.customer.name,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    pincode: order.customer.pincode,
    address_line1: order.customer.address1,
    address_line2: order.customer.address2 || null,
    city: order.customer.city,
    state: order.customer.state,
    country: order.customer.country,
    items: order.items,
    subtotal: order.subtotal,
    shipping_fee: order.shipping,
    total: order.total,
    payment_status: "pending",
    order_status: "received"
  };

  if(!client){
    // Supabase not configured yet — keep the demo flow usable locally.
    console.info("[demo mode] Order captured locally (Supabase not configured):", payload);
    return { ok: true, orderNumber, id: null, demo: true };
  }

  // Deliberately NOT chaining .select() here. PostgREST performs an
  // insert-with-RETURNING as one statement, and Postgres RLS applies the
  // table's SELECT policy to that RETURNING data too — not just the INSERT
  // policy. This table only grants SELECT to admins and to a signed-in
  // customer reading their OWN row (user_id = auth.uid()), so for a guest
  // checkout (no session) the insert itself succeeds but the attempted
  // "read the row back" step is rejected by RLS as a 403, which looks like
  // the order failed even though it was saved. We already generated
  // orderNumber client-side above, so there's nothing we need back from
  // the database — just insert and report success from the write alone.
  const { error } = await client.from("orders").insert(payload);
  if(error){
    console.error("Supabase createOrder error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, orderNumber };
}

/** Updates an order's payment status once Razorpay confirms (call this from
 *  your verified server/edge-function flow, not directly from the browser,
 *  for anything beyond a soft optimistic UI update). */
async function markOrderPaymentStatus(orderId, status, paymentId){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase not configured" };
  const { error } = await client
    .from("orders")
    .update({ payment_status: status, payment_id: paymentId || null })
    .eq("id", orderId);
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Contact form submissions. */
async function submitContactMessage(msg){
  const client = getSupabaseClient();
  const payload = {
    name: msg.name,
    email: msg.email,
    subject: msg.subject,
    message: msg.message
  };
  if(!client){
    console.info("[demo mode] Contact message captured locally (Supabase not configured):", payload);
    return { ok: true, demo: true };
  }
  const { error } = await client.from("contact_messages").insert(payload);
  if(error){
    console.error("Supabase submitContactMessage error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/* ============================================================
   Auth (Supabase email/password)
   Used by login.html, signup.html and the cart auth-gate in js/auth.js.
   Session is handled entirely by the Supabase JS SDK (stored in
   localStorage by default) — nothing custom to manage here.
   ============================================================ */

/** Creates an account. If email confirmation is ON in your Supabase Auth
 *  settings, data.session comes back null until the user clicks the
 *  confirmation link — the caller should tell the user to check their inbox. */
async function signUpWithPassword({ name, email, password }){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet. Add your project URL + anon key in js/supabase-client.js." };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  if(error) return { ok: false, error: error.message };
  return { ok: true, needsEmailConfirm: !data.session, user: data.user };
}

async function signInWithPassword({ email, password }){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet. Add your project URL + anon key in js/supabase-client.js." };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if(error) return { ok: false, error: error.message };
  return { ok: true, user: data.user };
}

async function signOut(){
  const client = getSupabaseClient();
  if(!client) return { ok: false };
  await client.auth.signOut();
  return { ok: true };
}

/** Current signed-in user, or null (also null if Supabase isn't configured). */
async function getCurrentUser(){
  const client = getSupabaseClient();
  if(!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

/** Starts the Google OAuth redirect flow. Supabase handles the redirect to
 *  Google and back — see README.md "Google login setup" for the one-time
 *  config needed in the Google Cloud Console + Supabase Auth dashboard.
 *  redirectPath defaults back to wherever the user started (cart, etc.). */
async function signInWithGoogle(redirectPath){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };

  const target = redirectPath && /^[a-zA-Z0-9_-]+\.html$/.test(redirectPath) ? redirectPath : "index.html";
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}${target}` }
  });
  if(error) return { ok: false, error: error.message };
  return { ok: true }; // browser navigates away to Google immediately
}

/** Sends a password-reset email. The link in that email lands the user back
 *  on `redirectHtmlPage` (must exist on this site) with a recovery session,
 *  where updatePassword() can then be called to set a new password. */
async function sendPasswordReset(email, redirectHtmlPage){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const redirectTo = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}${redirectHtmlPage}`;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sets a new password — only works when the browser is holding a valid
 *  recovery session (i.e. the user arrived via the reset-password email link). */
async function updatePassword(newPassword){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { error } = await client.auth.updateUser({ password: newPassword });
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Live product catalogue for the storefront. Only ever returns ACTIVE
 * products — RLS on public.products enforces this server-side too, so
 * even a tampered request can't see hidden/draft products. Falls back
 * to { ok:false } when Supabase isn't configured; callers should keep
 * using the static demo catalogue in that case (see js/products-data.js).
 */
async function fetchProducts(){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", products: [] };

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if(error) return { ok: false, error: error.message, products: [] };

  const products = (data || []).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    compareAt: p.compare_at != null ? Number(p.compare_at) : null,
    image: p.image_url,
    video: p.video_url || null,
    description: p.description || "",
    out_of_stock: !!p.out_of_stock,
    is_trending: !!p.is_trending,
    is_bestseller: !!p.is_bestseller,
    is_promotional: !!p.is_promotional
  }));
  return { ok: true, products };
}

/**
 * The signed-in customer's own orders, newest first. RLS already restricts
 * this to rows where orders.user_id = auth.uid() (see schema.sql) — this
 * function doesn't filter client-side, the database does it, so there's
 * nothing here a tampered request could use to see someone else's orders.
 */
async function fetchMyOrders(){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", orders: [] };

  const { data: userData } = await client.auth.getUser();
  if(!userData?.user) return { ok: false, error: "Not signed in.", orders: [] };

  const { data, error } = await client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if(error) return { ok: false, error: error.message, orders: [] };
  return { ok: true, orders: data || [] };
}

async function fetchHeroVideos(){
  const client = getSupabaseClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", videos: [] };

  const { data, error } = await client
    .from("hero_videos")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if(error) return { ok: false, error: error.message, videos: [] };
  return { ok: true, videos: data || [] };
}

window.DivaSupabase = {
  createOrder, markOrderPaymentStatus, submitContactMessage,
  signUpWithPassword, signInWithPassword, signInWithGoogle, signOut, getCurrentUser,
  sendPasswordReset, updatePassword, fetchProducts, fetchMyOrders, fetchHeroVideos
};
