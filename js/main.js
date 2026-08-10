/* ============================================================
   DIVA JEWELS — Shared site behavior
   ============================================================ */

/* ---------- Mobile nav ---------- */
function initNav(){
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if(!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
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

  if(product.compareAt){
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Sale";
    media.appendChild(badge);
  }

  const link = document.createElement("a");
  link.href = `products.html#${encodeURIComponent(product.id)}`;
  link.setAttribute("aria-label", product.name);
  const img = document.createElement("img");
  img.src = product.image;
  img.alt = product.name;
  img.loading = "lazy";
  link.appendChild(img);
  media.appendChild(link);

  const quick = document.createElement("div");
  quick.className = "product-quick";
  const addBtn = document.createElement("button");
  addBtn.className = "add-cart-btn btn-sm";
  addBtn.type = "button";
  addBtn.textContent = "Add to Cart";
  addBtn.addEventListener("click", () => handleAddToCart(product.id, addBtn));
  quick.appendChild(addBtn);
  media.appendChild(quick);

  const catEl = document.createElement("div");
  catEl.className = "product-cat";
  catEl.textContent = product.category;

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

  card.append(media, catEl, nameEl, priceEl);
  return card;
}
window.buildProductCard = buildProductCard;

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
  const featured = window.PRODUCTS.slice(0, 4);
  featured.forEach(p => grid.appendChild(buildProductCard(p)));
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
    paint(cat === "All" ? window.PRODUCTS : window.PRODUCTS.filter(p => p.category === cat));
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
    if(hash && categories.includes(hash)) {
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
  renderFeatured();
  renderProductsPage();
});
