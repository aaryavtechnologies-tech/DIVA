/* ============================================================
   DIVA JEWELS — Product catalogue
   ------------------------------------------------------------
   window.PRODUCTS is set synchronously to the static demo array
   below FIRST, so pages never see an empty catalogue even before
   the network request resolves (or if Supabase isn't configured).
   Then window.PRODUCTS_READY (a Promise) tries to fetch the LIVE
   catalogue from Supabase's `products` table — the one the admin
   panel's Products tab manages — and swaps window.PRODUCTS over if
   that succeeds. Anything that renders products or reads prices
   should `await window.PRODUCTS_READY` first (main.js, checkout.js
   already do). This file must load AFTER js/supabase-client.js.
   ============================================================ */

const DEMO_PRODUCTS = [
  {
    id: "dj-001",
    name: "Aurelia Gold Necklace",
    category: "Necklaces",
    price: 2499,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=800&q=80",
    description: "A fine gold-plated chain with a softly hammered finish that catches light with every turn. Layer it or wear it alone."
  },
  {
    id: "dj-002",
    name: "Stacked Ring Trio",
    category: "Rings",
    price: 1899,
    compareAt: 2299,
    image: "https://images.unsplash.com/photo-1633934542430-0905ccb5f050?auto=format&fit=crop&w=800&q=80",
    description: "Three slim bands designed to be worn together or apart — a set that grows with your collection."
  },
  {
    id: "dj-003",
    name: "Beaded Amethyst Necklace",
    category: "Necklaces",
    price: 2199,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=800&q=80",
    description: "Hand-strung glass beads in deep amethyst, finished with a delicate gold clasp."
  },
  {
    id: "dj-004",
    name: "Vintage Chain Bracelet",
    category: "Bracelets",
    price: 1599,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=800&q=80",
    description: "A textured link bracelet with an antiqued gold finish, inspired by heirloom jewelry boxes."
  },
  {
    id: "dj-005",
    name: "Sapphire Drop Earrings",
    category: "Earrings",
    price: 1799,
    compareAt: 2099,
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
    description: "Faceted blue stones set in a lightweight silver-tone drop — comfortable enough for all-day wear."
  },
  {
    id: "dj-006",
    name: "Bridal Necklace & Earring Set",
    category: "Sets",
    price: 4299,
    compareAt: 4999,
    image: "https://images.unsplash.com/photo-1722410180687-b05b50922362?auto=format&fit=crop&w=800&q=80",
    description: "A matching necklace and earring set with intricate detailing, made for your most special day."
  },
  {
    id: "dj-007",
    name: "Classic Gold Layer Necklace",
    category: "Necklaces",
    price: 2699,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1600721391776-b5cd0e0048f9?auto=format&fit=crop&w=800&q=80",
    description: "Two dainty chains of contrasting lengths, pre-layered so you never have to untangle them again."
  },
  {
    id: "dj-008",
    name: "Statement Gold Necklace",
    category: "Necklaces",
    price: 3199,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1620656798579-1984d9e87df7?auto=format&fit=crop&w=800&q=80",
    description: "Bold and sculptural, this piece is designed to be the first thing anyone notices."
  },
  {
    id: "dj-009",
    name: "Petite Pendant Necklace",
    category: "Necklaces",
    price: 1499,
    compareAt: 1799,
    image: "https://images.unsplash.com/photo-1569397288884-4d43d6738fbd?auto=format&fit=crop&w=800&q=80",
    description: "A tiny gold-tone pendant on a fine chain — an easy everyday layer."
  },
  {
    id: "dj-010",
    name: "Heirloom Jewelry Tray Set",
    category: "Sets",
    price: 3899,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1650455221359-3aebf920bcc5?auto=format&fit=crop&w=800&q=80",
    description: "A curated tray of gold-tone pieces, presented in a keepsake box — ready to gift."
  },
  {
    id: "dj-011",
    name: "Rosewood Beaded Necklace",
    category: "Necklaces",
    price: 1999,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1601121141418-c1caa10a2a0b?auto=format&fit=crop&w=800&q=80",
    description: "Warm-toned beads strung by hand, finished with a matte gold toggle clasp."
  },
  {
    id: "dj-012",
    name: "Trinity Gold Rings (Set of 3)",
    category: "Rings",
    price: 2099,
    compareAt: 2399,
    image: "https://images.unsplash.com/photo-1631982690223-8aa4be0a2497?auto=format&fit=crop&w=800&q=80",
    description: "Three signature bands presented in a keepsake box, ready to gift or keep."
  },
  {
    id: "dj-013",
    name: "Solitaire Promise Ring",
    category: "Rings",
    price: 2899,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
    description: "A single faceted stone on a slim band — quiet, classic, and endlessly wearable."
  },
  {
    id: "dj-014",
    name: "Noir Gold Necklace",
    category: "Necklaces",
    price: 2399,
    compareAt: null,
    image: "https://images.unsplash.com/photo-1651160670627-2896ddf7822f?auto=format&fit=crop&w=800&q=80",
    description: "A striking contrast of dark enamel and warm gold for evenings that call for a little drama."
  },
  {
    id: "dj-015",
    name: "Charm Bracelet Duo",
    category: "Bracelets",
    price: 1699,
    compareAt: 1999,
    image: "https://images.unsplash.com/photo-1679156271456-d6068c543ee7?auto=format&fit=crop&w=800&q=80",
    description: "Two stackable bracelets with tiny charms — mix, match, and make them yours."
  }
];

/* Fallback catalogue — used until (or unless) the live Supabase fetch
   below resolves. Every page can use window.PRODUCTS immediately. */
window.PRODUCTS = DEMO_PRODUCTS;

/* Kicks off the live fetch once and caches the same promise, so every
   page only fetches once even though this script tag runs on all of
   them. Resolves to the array that ended up in window.PRODUCTS. */
window.PRODUCTS_READY = (async function loadLiveProducts(){
  try{
    if(typeof window.DivaSupabase === "undefined" || typeof window.DivaSupabase.fetchProducts !== "function"){
      return window.PRODUCTS; // supabase-client.js not loaded yet/at all
    }
    const result = await window.DivaSupabase.fetchProducts();
    if(result.ok && result.products.length > 0){
      window.PRODUCTS = result.products;
    }
    // If Supabase is configured but the products table is empty, or the
    // fetch failed, we deliberately keep showing DEMO_PRODUCTS rather
    // than an empty storefront.
  }catch(err){
    console.warn("Could not load live products — showing demo catalogue instead.", err);
  }
  return window.PRODUCTS;
})();
