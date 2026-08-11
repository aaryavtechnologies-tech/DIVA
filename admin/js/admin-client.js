/* ============================================================
   DIVA JEWELS — Admin panel Supabase client
   ------------------------------------------------------------
   Deliberately uses the SAME anon key as the storefront (from
   js/supabase-client.js's window.DivaConfig) — NOT the
   service_role key. Access control is enforced by Postgres Row
   Level Security via the public.is_admin() function + the
   public.admins table (see supabase/schema.sql), keyed off the
   signed-in user's own session. The service_role key must never
   be shipped in any frontend file, admin or otherwise.
   ============================================================ */

let adminClient = null;

function getAdminClient(){
  if(adminClient) return adminClient;
  if(typeof window.supabase === "undefined"){
    console.warn("Supabase JS SDK not loaded.");
    return null;
  }
  const cfg = window.DivaConfig;
  if(!cfg || cfg.SUPABASE_URL.includes("YOUR-PROJECT-REF")){
    console.warn("Supabase is not configured yet — check js/supabase-client.js.");
    return null;
  }
  adminClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  return adminClient;
}

/** Email+password sign-in for the admin login page. */
async function adminSignIn({ email, password }){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if(error) return { ok: false, error: error.message };
  return { ok: true, user: data.user };
}

/** Confirms the current session belongs to a row in public.admins.
 *  Returns { ok, isAdmin, user }. If isAdmin is false, the caller
 *  should sign the session out — a non-admin should never stay
 *  signed in on the admin panel. */
async function adminCheckSession(){
  const client = getAdminClient();
  if(!client) return { ok: false, isAdmin: false, user: null };

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData?.session?.user || null;
  if(!user) return { ok: true, isAdmin: false, user: null };

  const { data, error } = await client.from("admins").select("id").eq("id", user.id).maybeSingle();
  if(error){
    console.error("adminCheckSession error:", error);
    return { ok: false, isAdmin: false, user };
  }
  return { ok: true, isAdmin: !!data, user };
}

async function adminSignOut(){
  const client = getAdminClient();
  if(!client) return;
  await client.auth.signOut();
}

/** Sends the "forgot password" email, landing the admin back on
 *  admin/reset-password.html to set a new one. */
async function adminSendPasswordReset(email){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const redirectTo = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}reset-password.html`;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

async function adminUpdatePassword(newPassword){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { error } = await client.auth.updateUser({ password: newPassword });
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

/** All orders, newest first. RLS only returns rows to a session
 *  that's actually in public.admins, so this is safe even though
 *  it runs with the plain anon key from the browser. */
async function adminFetchOrders(){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", orders: [] };
  const { data, error } = await client.from("orders").select("*").order("created_at", { ascending: false });
  if(error) return { ok: false, error: error.message, orders: [] };
  return { ok: true, orders: data || [] };
}

async function adminUpdateOrderStatus(orderId, orderStatus){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { error } = await client.from("orders").update({ order_status: orderStatus }).eq("id", orderId);
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

async function adminUpdatePaymentStatus(orderId, paymentStatus){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { error } = await client.from("orders").update({ payment_status: paymentStatus }).eq("id", orderId);
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

async function adminFetchInquiries(){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", inquiries: [] };
  const { data, error } = await client.from("contact_messages").select("*").order("created_at", { ascending: false });
  if(error) return { ok: false, error: error.message, inquiries: [] };
  return { ok: true, inquiries: data || [] };
}

/* ============================================================
   Products — full CRUD. RLS (public.products policies in
   schema.sql) means these only succeed for a session that's
   actually in public.admins, even though it's the plain anon key.
   ============================================================ */

/** Every product, active or hidden — newest first. Admin-only view;
 *  the public storefront only ever sees active = true (see
 *  js/supabase-client.js's fetchProducts()). */
async function adminFetchProducts(){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", products: [] };
  const { data, error } = await client.from("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if(error) return { ok: false, error: error.message, products: [] };
  return { ok: true, products: data || [] };
}

/** payload: { name, category, price, compare_at, image_url, description, active, sort_order } */
async function adminCreateProduct(payload){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { data, error } = await client.from("products").insert(payload).select().single();
  if(error) return { ok: false, error: error.message };
  return { ok: true, product: data };
}

async function adminUpdateProduct(id, payload){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { data, error } = await client.from("products").update(payload).eq("id", id).select().single();
  if(error) return { ok: false, error: error.message };
  return { ok: true, product: data };
}

async function adminDeleteProduct(id){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { error } = await client.from("products").delete().eq("id", id);
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Uploads a product photo to the public `product-images` Storage
 *  bucket and returns its public URL (to save into products.image_url).
 *  Storage policies (schema.sql) restrict writes to admins only. */
async function adminUploadProductImage(file){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  if(!file) return { ok: false, error: "No file selected." };
  if(!file.type.startsWith("image/")) return { ok: false, error: "Please choose an image file." };
  if(file.size > 5 * 1024 * 1024) return { ok: false, error: "Image must be under 5MB." };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await client.storage.from("product-images").upload(path, file, { upsert: false });
  if(uploadError) return { ok: false, error: uploadError.message };

  const { data } = client.storage.from("product-images").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** Uploads a product video to the SAME `product-images` Storage bucket
 *  (the bucket isn't type-restricted, and its RLS already limits writes
 *  to admins / reads to everyone — see schema.sql) and returns its
 *  public URL, to save into products.video_url. Kept as a separate
 *  function from the image uploader only because of the different
 *  type/size limits a video needs. */
async function adminUploadProductVideo(file){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  if(!file) return { ok: false, error: "No file selected." };
  if(!file.type.startsWith("video/")) return { ok: false, error: "Please choose a video file." };
  if(file.size > 50 * 1024 * 1024) return { ok: false, error: "Video must be under 50MB." };

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await client.storage.from("product-images").upload(path, file, { upsert: false });
  if(uploadError) return { ok: false, error: uploadError.message };

  const { data } = client.storage.from("product-images").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

async function adminFetchHeroVideos(){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet.", videos: [] };
  const { data, error } = await client.from("hero_videos").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if(error) return { ok: false, error: error.message, videos: [] };
  return { ok: true, videos: data || [] };
}

async function adminCreateHeroVideo(payload){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { data, error } = await client.from("hero_videos").insert([payload]).select().maybeSingle();
  if(error) return { ok: false, error: error.message };
  return { ok: true, video: data };
}

async function adminUpdateHeroVideo(id, payload){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { data, error } = await client.from("hero_videos").update(payload).eq("id", id).select().maybeSingle();
  if(error) return { ok: false, error: error.message };
  return { ok: true, video: data };
}

async function adminDeleteHeroVideo(id){
  const client = getAdminClient();
  if(!client) return { ok: false, error: "Supabase is not configured yet." };
  const { error } = await client.from("hero_videos").delete().eq("id", id);
  if(error) return { ok: false, error: error.message };
  return { ok: true };
}

window.DivaAdmin = {
  adminSignIn, adminCheckSession, adminSignOut,
  adminSendPasswordReset, adminUpdatePassword,
  adminFetchOrders, adminUpdateOrderStatus, adminUpdatePaymentStatus,
  adminFetchInquiries,
  adminFetchProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct,
  adminUploadProductImage, adminUploadProductVideo,
  adminFetchHeroVideos, adminCreateHeroVideo, adminUpdateHeroVideo, adminDeleteHeroVideo
};
