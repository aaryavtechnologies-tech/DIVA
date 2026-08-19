/* ============================================================
   DIVA JEWELS — Shared site behavior
   ============================================================ */

/* ---------- Mobile nav (off-canvas drawer + backdrop) ---------- */
function initNav(){
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  const backdrop = document.querySelector("[data-nav-backdrop]");
  const closeBtn = document.querySelector("[data-nav-close]");
  if(!toggle || !nav) return;

  function openNav(){
    nav.classList.add("open");
    backdrop?.classList.add("open");
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
  }
  function closeNav(){
    nav.classList.remove("open");
    backdrop?.classList.remove("open");
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    nav.classList.contains("open") ? closeNav() : openNav();
  });
  closeBtn?.addEventListener("click", closeNav);
  backdrop?.addEventListener("click", closeNav);
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeNav(); });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", (e) => {
    setTimeout(closeNav, 100);
  }));
  window.addEventListener("resize", () => { if(window.innerWidth > 900) closeNav(); });
}

/* ---------- Announcement bar rotation ---------- */
function initAnnounce(){
  const track = document.querySelector(".announce-track");
  if(!track) return;
  const items = Array.from(track.querySelectorAll("span"));
  if(items.length <= 1) return;
  let index = items.findIndex(el => el.classList.contains("active"));
  if(index < 0) index = 0;

  function show(i){
    items.forEach(el => el.classList.remove("active"));
    items[i].classList.add("active");
  }
  function step(dir){
    index = (index + dir + items.length) % items.length;
    show(index);
  }
  document.querySelectorAll("[data-announce-prev]").forEach(b => b.addEventListener("click", () => step(-1)));
  document.querySelectorAll("[data-announce-next]").forEach(b => b.addEventListener("click", () => step(1)));

  let timer = setInterval(() => step(1), 5000);
  track.closest(".announce")?.addEventListener("mouseenter", () => clearInterval(timer));
  track.closest(".announce")?.addEventListener("mouseleave", () => { timer = setInterval(() => step(1), 5000); });
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(message){
  let toast = document.querySelector(".toast");
  if(!toast){
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message; // textContent only — never innerHTML with user-influenced text
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
window.showToast = showToast;

/* ---------- Currency ---------- */
function formatINR(amount){
  return "₹" + Number(amount).toLocaleString("en-IN");
}
window.formatINR = formatINR;

/* ---------- Product card builder (DOM APIs only — no innerHTML with data) ---------- */
function buildProductCard(product){
  const card = document.createElement("article");
  card.className = "product-card";
  card.dataset.category = product.category;

  const media = document.createElement("div");
  media.className = "product-media";

  const link = document.createElement("a");
  link.href = `products.html#${encodeURIComponent(product.id)}`;
  link.setAttribute("aria-label", product.name);
  const img = document.createElement("img");
  img.src = product.image;
  img.alt = product.name;
  img.loading = "lazy";
  link.appendChild(img);
  media.appendChild(link);

  if (product.is_trending || product.is_bestseller || product.is_promotional) {
    const tagBadge = document.createElement("div");
    tagBadge.className = "bookmark-tag";
    if (product.is_trending) tagBadge.textContent = "Trending";
    else if (product.is_bestseller) tagBadge.textContent = "Best Seller";
    else if (product.is_promotional) tagBadge.textContent = "Promotional";
    media.appendChild(tagBadge);
  }

  if (product.out_of_stock) {
    card.classList.add("out-of-stock");
    const oosBadge = document.createElement("span");
    oosBadge.className = "oos-banner";
    oosBadge.textContent = "OUT OF STOCK";
    media.appendChild(oosBadge);
  }

  if(product.video){
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "product-video-btn";
    playBtn.setAttribute("aria-label", `Play video of ${product.name}`);
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openProductVideo(product); });
    media.appendChild(playBtn);
  }

  const catEl = document.createElement("div");
  catEl.className = "product-cat";
  catEl.textContent = product.category;

  if(product.compareAt){
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Sale";
    catEl.prepend(badge, document.createElement("br"));
  }

  const nameEl = document.createElement("h3");
  nameEl.className = "product-name";
  nameEl.textContent = product.name;

  const priceEl = document.createElement("div");
  priceEl.className = "product-price";
  if(product.compareAt){
    const was = document.createElement("span");
    was.className = "was";
    was.textContent = formatINR(product.compareAt);
    priceEl.appendChild(was);
  }
  priceEl.appendChild(document.createTextNode(formatINR(product.price)));

  const quick = document.createElement("div");
  quick.className = "product-quick";
  const addBtn = document.createElement("button");
  addBtn.className = "add-cart-btn";
  addBtn.type = "button";
  if (product.out_of_stock) {
    addBtn.disabled = true;
    addBtn.textContent = "Out of Stock";
  } else {
    addBtn.textContent = "Add to Cart";
    addBtn.addEventListener("click", () => handleAddToCart(product.id, addBtn));
  }
  quick.appendChild(addBtn);

  card.append(media, catEl, nameEl, priceEl, quick);
  return card;
}
window.buildProductCard = buildProductCard;

/* ---------- Product video lightbox (built on demand, shared by every page) ---------- */
function openProductVideo(product){
  let overlay = document.querySelector("[data-video-lightbox]");
  if(!overlay){
    overlay = document.createElement("div");
    overlay.className = "modal-overlay video-lightbox";
    overlay.setAttribute("data-video-lightbox", "");
    overlay.innerHTML = `
      <div class="modal-box video-lightbox-box">
        <button type="button" class="video-lightbox-close" aria-label="Close video">&times;</button>
        <video data-video-lightbox-player controls playsinline></video>
        <h3 data-video-lightbox-title></h3>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if(e.target === overlay) closeProductVideo(); });
    overlay.querySelector(".video-lightbox-close").addEventListener("click", closeProductVideo);
    document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeProductVideo(); });
  }
  const player = overlay.querySelector("[data-video-lightbox-player]");
  player.src = product.video;
  overlay.querySelector("[data-video-lightbox-title]").textContent = product.name;
  overlay.classList.add("open");
  player.play().catch(() => {});
}
function closeProductVideo(){
  const overlay = document.querySelector("[data-video-lightbox]");
  if(!overlay) return;
  overlay.classList.remove("open");
  const player = overlay.querySelector("[data-video-lightbox-player]");
  player.pause();
  player.removeAttribute("src");
  player.load();
}

function handleAddToCart(productId, btnEl){
  Cart.add(productId, 1);
  const product = window.PRODUCTS.find(p => p.id === productId);
  showToast(`${product ? product.name : "Item"} added to your bag`);
  if(btnEl){
    const original = btnEl.textContent;
    btnEl.textContent = "Added ✓";
    btnEl.classList.add("added");
    setTimeout(() => { btnEl.textContent = original; btnEl.classList.remove("added"); }, 1400);
  }
}
window.handleAddToCart = handleAddToCart;

/* ---------- Home page: featured products ---------- */
function renderFeatured(){
  const grid = document.querySelector("[data-featured-grid]");
  if(!grid) return;
  const featured = window.PRODUCTS.slice(0, 10);
  featured.forEach(p => grid.appendChild(buildProductCard(p)));
}

/* ---------- Home page: dynamic hero videos ---------- */
async function renderHeroVideos() {
  const grid = document.querySelector("[data-hero-videos-grid]");
  if (!grid) return;

  let videos = [];
  if (typeof window.DivaSupabase !== "undefined" && typeof window.DivaSupabase.fetchHeroVideos === "function") {
    const res = await window.DivaSupabase.fetchHeroVideos();
    if (res.ok && res.videos.length > 0) {
      videos = res.videos;
    }
  }

  // Fallback if no Supabase or empty table
  if (videos.length === 0) {
    videos = [
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", poster_url: "https://images.unsplash.com/photo-1569397288884-4d43d6738fbd?auto=format&fit=crop&w=500&q=80" },
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", poster_url: "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=500&q=80" },
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", poster_url: "https://images.unsplash.com/photo-1631982690223-8aa4be0a2497?auto=format&fit=crop&w=500&q=80" },
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4", poster_url: "https://images.unsplash.com/photo-1650455221359-3aebf920bcc5?auto=format&fit=crop&w=500&q=80" },
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4", poster_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=500&q=80" },
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", poster_url: "https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&w=500&q=80" },
      { video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4", poster_url: "https://images.unsplash.com/photo-1599643478524-fb66f7ca066b?auto=format&fit=crop&w=500&q=80" }
    ];
  }

  grid.innerHTML = "";
  videos.forEach(v => {
    const vid = document.createElement("video");
    vid.className = "sparkle-video";
    vid.src = v.video_url;
    vid.poster = v.poster_url;
    
    // Explicitly set attributes for broader browser support (especially iOS Safari)
    vid.setAttribute("autoplay", "");
    vid.setAttribute("loop", "");
    vid.setAttribute("muted", "");
    vid.setAttribute("playsinline", "");
    
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    
    grid.appendChild(vid);
  });

  const domVideos = grid.querySelectorAll('.sparkle-video');
  const playVideos = () => {
    domVideos.forEach(vid => {
      if (vid.paused) {
        vid.play().catch(e => console.log('Autoplay blocked:', e));
      }
    });
  };
  
  playVideos();
  document.body.addEventListener('click', playVideos, { once: true });
  document.body.addEventListener('touchstart', playVideos, { once: true });
}

/* ---------- Products page: full grid + filters ---------- */
function renderProductsPage(){
  const grid = document.querySelector("[data-product-grid]");
  if(!grid) return;

  const categories = ["All", ...Array.from(new Set(window.PRODUCTS.map(p => p.category)))];
  const filterRow = document.querySelector("[data-filter-row]");

  function paint(list){
    grid.innerHTML = "";
    if(list.length === 0){
      const empty = document.createElement("p");
      empty.className = "center";
      empty.textContent = "No pieces found in this category yet.";
      grid.appendChild(empty);
      return;
    }
    list.forEach(p => grid.appendChild(buildProductCard(p)));
  }

  function applyFilter(cat){
    if(filterRow){
      filterRow.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      const pill = Array.from(filterRow.querySelectorAll(".filter-pill")).find(p => p.textContent === cat);
      if(pill) pill.classList.add("active");
    }
    
    if (cat === "tag-Trending") {
      paint(window.PRODUCTS.filter(p => p.is_trending));
    } else if (cat === "tag-BestSeller") {
      paint(window.PRODUCTS.filter(p => p.is_bestseller));
    } else {
      paint(cat === "All" ? window.PRODUCTS : window.PRODUCTS.filter(p => p.category === cat));
    }
  }

  if(filterRow){
    categories.forEach(cat => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "filter-pill";
      pill.textContent = cat;
      pill.addEventListener("click", () => {
        if(cat === "All") history.pushState("", document.title, window.location.pathname + window.location.search);
        else window.location.hash = cat;
        applyFilter(cat);
      });
      filterRow.appendChild(pill);
    });
  }

  function checkHash(){
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash === "tag-Trending" || hash === "tag-BestSeller") {
      applyFilter(hash);
    } else if (hash && categories.includes(hash)) {
      applyFilter(hash);
    } else {
      applyFilter("All");
    }
  }

  window.addEventListener("hashchange", checkHash);
  checkHash();
}

/* ---------- Contact form ---------- */
function initContactForm(){
  const form = document.querySelector("#contact-form");
  if(!form) return;
  const status = form.querySelector(".form-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Honeypot: bots tend to fill every field, humans never see this one.
    if(form.querySelector('[name="company"]')?.value){
      return;
    }

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    let valid = true;
    valid = validateField(form.name, name.length >= 2) && valid;
    valid = validateField(form.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && valid;
    valid = validateField(form.message, message.length >= 10) && valid;
    if(!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const result = await window.DivaSupabase.submitContactMessage({ name, email, subject, message });

    submitBtn.disabled = false;
    submitBtn.textContent = "Send Message";

    status.classList.remove("ok", "err");
    if(result.ok){
      status.textContent = "Thank you — we'll get back to you within 1–2 business days.";
      status.classList.add("show", "ok");
      form.reset();
    }else{
      status.textContent = "Something went wrong sending your message. Please try again in a moment.";
      status.classList.add("show", "err");
    }
  });
}

function validateField(input, isValid){
  const field = input.closest(".form-field");
  if(field) field.classList.toggle("invalid", !isValid);
  return isValid;
}
window.validateField = validateField;

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initAnnounce();
  initContactForm();
  // Wait for the live product fetch (or its fallback) before painting
  // any product grids, so prices/images reflect what's actually live.
  if(window.PRODUCTS_READY) await window.PRODUCTS_READY;

  if (window.PRODUCTS) {
    window.PRODUCTS.sort((a,b) => {
      // Out of stock items always go to the very bottom
      if (a.out_of_stock && !b.out_of_stock) return 1;
      if (!a.out_of_stock && b.out_of_stock) return -1;
      
      // Otherwise, prioritize tagged items
      const aTagged = a.is_trending || a.is_bestseller || a.is_promotional ? 1 : 0;
      const bTagged = b.is_trending || b.is_bestseller || b.is_promotional ? 1 : 0;
      return bTagged - aTagged;
    });
  }

  renderFeatured();
  renderProductsPage();
  renderHeroVideos();
});
