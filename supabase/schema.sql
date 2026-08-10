-- ============================================================
-- DIVA JEWELS — Supabase schema (v2 — adds admin + customer auth)
-- Run this whole file once in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent (if not exists /
-- or replace / drop-then-create), so re-running after a partial
-- run won't error out or duplicate anything.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Base table-level privileges.
-- RLS policies (further down) only control WHICH ROWS a role can
-- see/change once it already has permission to touch the table at
-- all. Postgres checks that base permission first — without these
-- GRANTs, anon/authenticated get "permission denied for table X"
-- (error 42501) no matter how permissive the RLS policies are.
-- Supabase's dashboard table editor grants these automatically when
-- you create a table through the UI; tables created via raw SQL (like
-- this file) need it done explicitly. Safe to re-run.
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert on public.orders to anon, authenticated;
grant update on public.orders to authenticated;

grant select, insert on public.contact_messages to anon, authenticated;

grant select on public.admins to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- ------------------------------------------------------------
-- orders
-- One row per checkout attempt, written the moment the customer
-- submits their address — BEFORE payment is attempted — so an
-- order is never lost even if payment fails or the tab closes.
-- ------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text unique not null,

  user_id           uuid references auth.users(id) on delete set null,

  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text not null,
  pincode           text not null,
  address_line1     text not null,
  address_line2     text,
  city              text not null,
  state             text not null,
  country           text not null default 'India',

  items             jsonb not null,        -- [{id, name, price, qty}]
  subtotal          numeric(10,2) not null,
  shipping_fee      numeric(10,2) not null default 0,
  total             numeric(10,2) not null,

  payment_status    text not null default 'pending'
                     check (payment_status in ('pending','paid','failed','refunded')),
  payment_id        text,                  -- Razorpay payment id, set server-side
  razorpay_order_id text,                  -- Razorpay order id, set server-side

  -- received/processing = "ongoing", shipped/out_for_delivery = "on route"
  order_status      text not null default 'received'
                     check (order_status in ('received','processing','shipped','out_for_delivery','delivered','cancelled')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- add user_id / new order_status values if this is an upgrade from v1
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders add constraint orders_order_status_check
  check (order_status in ('received','processing','shipped','out_for_delivery','delivered','cancelled'));

create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_order_status_idx   on public.orders (order_status);
create index if not exists orders_created_at_idx      on public.orders (created_at desc);
create index if not exists orders_user_id_idx         on public.orders (user_id);

-- keep updated_at fresh on every change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- contact_messages ("Inquiries" in the admin panel)
-- ------------------------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text,
  message     text not null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- admins
-- Whoever's auth.users row has a matching id here is an admin.
-- There is deliberately NO public signup path for this table —
-- rows are added by you, by hand, in the SQL editor (see the
-- "Add an admin" snippet at the bottom of this file).
-- ------------------------------------------------------------
create table if not exists public.admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- security-definer helper: safe to call from RLS policies without
-- recursively re-checking RLS on public.admins itself.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admins enable row level security;

-- orders: anon (public storefront) may INSERT only — never read,
-- edit or delete another customer's order.
drop policy if exists "public can insert orders" on public.orders;
create policy "public can insert orders"
  on public.orders for insert
  to anon, authenticated
  with check (true);

-- orders: a signed-in customer may read their OWN orders (order
-- history / status tracking), nothing else.
drop policy if exists "customers can view own orders" on public.orders;
create policy "customers can view own orders"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

-- orders: admins may read every order.
drop policy if exists "admins can view all orders" on public.orders;
create policy "admins can view all orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

-- orders: only admins may update (e.g. order_status, payment_status).
drop policy if exists "admins can update orders" on public.orders;
create policy "admins can update orders"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- contact_messages: anon may INSERT only.
drop policy if exists "public can insert contact messages" on public.contact_messages;
create policy "public can insert contact messages"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

-- contact_messages: only admins may read (this is the "Inquiries" tab).
drop policy if exists "admins can view contact messages" on public.contact_messages;
create policy "admins can view contact messages"
  on public.contact_messages for select
  to authenticated
  using (public.is_admin());

-- admins table: an admin may check their OWN row (used by the admin
-- panel to confirm access after login). No insert/update/delete from
-- the browser, ever — that only happens by hand in the SQL editor.
drop policy if exists "admins can read own admin row" on public.admins;
create policy "admins can read own admin row"
  on public.admins for select
  to authenticated
  using (id = auth.uid());

-- ------------------------------------------------------------
-- products
-- The live catalogue. The storefront (js/products-data.js) reads
-- ACTIVE products straight from this table with the anon key;
-- the admin panel's Products tab has full CRUD via public.is_admin().
-- ------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  price        numeric(10,2) not null check (price >= 0),
  compare_at   numeric(10,2) check (compare_at is null or compare_at >= 0),
  image_url    text not null default '',
  description  text not null default '',
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.products add column if not exists video_url text;
create index if not exists products_active_idx   on public.products (active);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_sort_idx     on public.products (sort_order);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- public storefront (anon + signed-in customers) may read ACTIVE
-- products only — never drafts/hidden ones.
drop policy if exists "public can view active products" on public.products;
create policy "public can view active products"
  on public.products for select
  to anon, authenticated
  using (active = true);

-- admins may read every product, active or not (so they can see what
-- they've hidden/drafted, not just what's live).
drop policy if exists "admins can view all products" on public.products;
create policy "admins can view all products"
  on public.products for select
  to authenticated
  using (public.is_admin());

-- admins: full CRUD. This is the "full control" surface for Phase 2 —
-- add, edit (name/price/image/etc.), or delete any product.
drop policy if exists "admins can insert products" on public.products;
create policy "admins can insert products"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update products" on public.products;
create policy "admins can update products"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete products" on public.products;
create policy "admins can delete products"
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- Storage bucket for product images, so admins can upload a file
-- instead of only pasting an external URL. Public bucket (product
-- photos are meant to be visible on the storefront) but writes are
-- still locked to admins only.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "admins can upload product images" on storage.objects;
create policy "admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins can update product images" on storage.objects;
create policy "admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins can delete product images" on storage.objects;
create policy "admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ============================================================
-- OPTIONAL one-time seed: migrates the 15 demo items that were
-- hardcoded in js/products-data.js into the real table, so the
-- admin panel isn't starting from an empty catalogue. Safe to run
-- once — re-running it will insert duplicates, so don't re-run.
-- Skip this entirely if you'd rather start from scratch.
-- ============================================================
-- insert into public.products (name, category, price, compare_at, image_url, description, sort_order) values
-- ('Aurelia Gold Necklace','Necklaces',2499,null,'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=800&q=80','A fine gold-plated chain with a softly hammered finish that catches light with every turn. Layer it or wear it alone.',1),
-- ('Stacked Ring Trio','Rings',1899,2299,'https://images.unsplash.com/photo-1633934542430-0905ccb5f050?auto=format&fit=crop&w=800&q=80','Three slim bands designed to be worn together or apart — a set that grows with your collection.',2),
-- ('Beaded Amethyst Necklace','Necklaces',2199,null,'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=800&q=80','Hand-strung glass beads in deep amethyst, finished with a delicate gold clasp.',3),
-- ('Vintage Chain Bracelet','Bracelets',1599,null,'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=800&q=80','A textured link bracelet with an antiqued gold finish, inspired by heirloom jewelry boxes.',4),
-- ('Sapphire Drop Earrings','Earrings',1799,2099,'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80','Faceted blue stones set in a lightweight silver-tone drop — comfortable enough for all-day wear.',5),
-- ('Bridal Necklace & Earring Set','Sets',4299,4999,'https://images.unsplash.com/photo-1722410180687-b05b50922362?auto=format&fit=crop&w=800&q=80','A matching necklace and earring set with intricate detailing, made for your most special day.',6),
-- ('Classic Gold Layer Necklace','Necklaces',2699,null,'https://images.unsplash.com/photo-1600721391776-b5cd0e0048f9?auto=format&fit=crop&w=800&q=80','Two dainty chains of contrasting lengths, pre-layered so you never have to untangle them again.',7),
-- ('Statement Gold Necklace','Necklaces',3199,null,'https://images.unsplash.com/photo-1620656798579-1984d9e87df7?auto=format&fit=crop&w=800&q=80','Bold and sculptural, this piece is designed to be the first thing anyone notices.',8),
-- ('Petite Pendant Necklace','Necklaces',1499,1799,'https://images.unsplash.com/photo-1569397288884-4d43d6738fbd?auto=format&fit=crop&w=800&q=80','A tiny gold-tone pendant on a fine chain — an easy everyday layer.',9),
-- ('Heirloom Jewelry Tray Set','Sets',3899,null,'https://images.unsplash.com/photo-1650455221359-3aebf920bcc5?auto=format&fit=crop&w=800&q=80','A curated tray of gold-tone pieces, presented in a keepsake box — ready to gift.',10),
-- ('Rosewood Beaded Necklace','Necklaces',1999,null,'https://images.unsplash.com/photo-1601121141418-c1caa10a2a0b?auto=format&fit=crop&w=800&q=80','Warm-toned beads strung by hand, finished with a matte gold toggle clasp.',11),
-- ('Trinity Gold Rings (Set of 3)','Rings',2099,2399,'https://images.unsplash.com/photo-1631982690223-8aa4be0a2497?auto=format&fit=crop&w=800&q=80','Three signature bands presented in a keepsake box, ready to gift or keep.',12),
-- ('Solitaire Promise Ring','Rings',2899,null,'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80','A single faceted stone on a slim band — quiet, classic, and endlessly wearable.',13),
-- ('Noir Gold Necklace','Necklaces',2399,null,'https://images.unsplash.com/photo-1651160670627-2896ddf7822f?auto=format&fit=crop&w=800&q=80','A striking contrast of dark enamel and warm gold for evenings that call for a little drama.',14),
-- ('Charm Bracelet Duo','Bracelets',1699,1999,'https://images.unsplash.com/photo-1679156271456-d6068c543ee7?auto=format&fit=crop&w=800&q=80','Two stackable bracelets with tiny charms — mix, match, and make them yours.',15);

-- ============================================================
-- Add an admin (run this once per admin, after they've signed up
-- for a normal Supabase Auth account — e.g. via Supabase Studio →
-- Authentication → Add user, or by letting them sign up and then
-- promoting them here):
--
--   insert into public.admins (id, email)
--   select id, email from auth.users where email = 'owner@example.com'
--   on conflict (id) do nothing;
--
-- To revoke admin access:
--   delete from public.admins where email = 'owner@example.com';
-- ============================================================

-- ------------------------------------------------------------
-- Suggested next steps:
-- 1. A Supabase Edge Function `create-razorpay-order` that takes an order id,
--    calls Razorpay's Orders API with your KEY_SECRET, and returns the
--    razorpay_order_id to the browser (never expose KEY_SECRET client-side).
-- 2. A Supabase Edge Function `razorpay-webhook` that verifies the Razorpay
--    signature and updates orders.payment_status + orders.payment_id. This
--    is the step that guarantees no paid order is ever missed, even if the
--    customer's browser crashes right after paying.
-- ============================================================
-- v3 note: the `products` table + Storage bucket above are done — the
-- storefront now reads live products via the anon key (active = true
-- only) and the admin Products tab has full CRUD. See PHASE-3-TODO.md.
-- ============================================================
