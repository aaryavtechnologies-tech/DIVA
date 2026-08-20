/* ============================================================
   DIVA JEWELS — Admin dashboard app logic
   ============================================================ */

const ORDER_STATUSES = [
  { value: "received", label: "Received" },          // ongoing
  { value: "processing", label: "Processing" },        // ongoing
  { value: "shipped", label: "Shipped" },           // on route
  { value: "out_for_delivery", label: "Out for Delivery" },  // on route
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

let allOrders = [];
let allInquiries = [];

/* ---------- Auth guard ---------- */
async function guardAdminAccess() {
  const check = await window.DivaAdmin.adminCheckSession();

  if (!check.ok || !check.user) {
    window.location.href = "login.html";
    return false;
  }
  if (!check.isAdmin) {
    await window.DivaAdmin.adminSignOut();
    window.location.href = "login.html";
    return false;
  }

  document.querySelector("[data-admin-email]").textContent = check.user.email;
  document.querySelector("#auth-checking").classList.add("hidden");
  document.querySelector("#dashboard-shell").classList.remove("hidden");
  return true;
}

/* ---------- Sidebar nav ---------- */
function initPanelNav() {
  const buttons = document.querySelectorAll("[data-panel-btn]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.panelBtn;
      document.querySelectorAll("[data-panel]").forEach(p => {
        p.classList.toggle("active", p.dataset.panel === target);
      });
    });
  });
}

/* ---------- Mobile Navigation ---------- */
function initMobileNav() {
  const menuBtn = document.querySelector(".admin-mobile-menu-btn");
  const closeBtn = document.querySelector(".admin-sidebar-close");
  const sidebar = document.querySelector(".admin-sidebar");
  const overlay = document.querySelector(".admin-sidebar-overlay");

  if (!menuBtn || !sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }

  menuBtn.addEventListener("click", openSidebar);
  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);

  // Close sidebar when a navigation item is clicked
  const navButtons = document.querySelectorAll(".admin-nav button");
  navButtons.forEach(btn => {
    btn.addEventListener("click", closeSidebar);
  });
}

/* ---------- Formatting helpers ---------- */
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function statusLabel(value) {
  const found = ORDER_STATUSES.find(s => s.value === value);
  return found ? found.label : value;
}

/* ---------- Orders panel ---------- */
async function loadOrders() {
  const body = document.querySelector("[data-orders-body]");
  const result = await window.DivaAdmin.adminFetchOrders();

  if (!result.ok) {
    body.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "admin-empty";
    td.textContent = "Couldn't load orders: " + (result.error || "unknown error");
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  allOrders = result.orders;
  renderOrderStats();
  paintOrders(allOrders);

  const pendingCount = allOrders.filter(o => o.order_status === "received" || o.order_status === "processing").length;
  const badge = document.querySelector("[data-orders-badge]");
  if (pendingCount > 0) { badge.textContent = pendingCount; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

function renderOrderStats() {
  const wrap = document.querySelector("[data-order-stats]");
  wrap.innerHTML = "";
  const stats = [
    { label: "Total Orders", value: allOrders.length },
    { label: "Awaiting Payment", value: allOrders.filter(o => o.payment_status === "pending").length },
    { label: "In Transit", value: allOrders.filter(o => o.order_status === "shipped" || o.order_status === "out_for_delivery").length },
    { label: "Delivered", value: allOrders.filter(o => o.order_status === "delivered").length },
  ];
  stats.forEach(s => {
    const card = document.createElement("div");
    card.className = "admin-stat-card";
    const n = document.createElement("div"); n.className = "n"; n.textContent = s.value;
    const l = document.createElement("div"); l.className = "l"; l.textContent = s.label;
    card.append(n, l);
    wrap.appendChild(card);
  });
}

function paintOrders(list) {
  const body = document.querySelector("[data-orders-body]");
  body.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "admin-empty";
    td.textContent = "No orders yet.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  list.forEach(order => {
    const tr = document.createElement("tr");

    const orderNumTd = document.createElement("td");
    orderNumTd.setAttribute("data-label", "Order #");
    orderNumTd.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = order.order_number;
    orderNumTd.appendChild(strong);

    const custTd = document.createElement("td");
    custTd.setAttribute("data-label", "Customer");
    const nameDiv = document.createElement("div");
    nameDiv.textContent = order.customer_name;
    const emailDiv = document.createElement("div");
    emailDiv.classList.add("u-meta-line");
    emailDiv.textContent = order.customer_email;
    const phoneDiv = document.createElement("div");
    phoneDiv.classList.add("u-meta-line");
    phoneDiv.textContent = order.customer_phone;
    custTd.append(nameDiv, emailDiv, phoneDiv);

    const itemsTd = document.createElement("td");
    itemsTd.className = "admin-order-items";
    itemsTd.setAttribute("data-label", "Items");
    (order.items || []).forEach(item => {
      const div = document.createElement("div");
      div.textContent = `${item.qty}× ${item.name}`;
      itemsTd.appendChild(div);
    });

    const addrTd = document.createElement("td");
    addrTd.className = "admin-order-addr";
    addrTd.setAttribute("data-label", "Address");
    addrTd.textContent = `${order.address_line1}${order.address_line2 ? ", " + order.address_line2 : ""}, ${order.city}, ${order.state} ${order.pincode}`;

    const totalTd = document.createElement("td");
    totalTd.setAttribute("data-label", "Total");
    totalTd.textContent = inr(order.total);

    const paymentTd = document.createElement("td");
    paymentTd.setAttribute("data-label", "Payment");
    const paySpan = document.createElement("span");
    paySpan.className = "badge-status badge-" + order.payment_status;
    paySpan.textContent = order.payment_status;
    paymentTd.appendChild(paySpan);

    const statusTd = document.createElement("td");
    statusTd.setAttribute("data-label", "Order Status");
    const select = document.createElement("select");
    select.className = "status-select";
    ORDER_STATUSES.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      if (s.value === order.order_status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", async () => {
      const prev = order.order_status;
      select.disabled = true;
      const res = await window.DivaAdmin.adminUpdateOrderStatus(order.id, select.value);
      select.disabled = false;
      if (res.ok) {
        order.order_status = select.value;
        showToast(`${order.order_number} marked "${statusLabel(select.value)}"`);
        renderOrderStats();
      } else {
        select.value = prev;
        showToast("Couldn't update status: " + (res.error || "unknown error"));
      }
    });
    statusTd.appendChild(select);

    const dateTd = document.createElement("td");
    dateTd.classList.add("u-meta-date");
    dateTd.setAttribute("data-label", "Placed");
    dateTd.textContent = formatDate(order.created_at);

    tr.append(orderNumTd, custTd, itemsTd, addrTd, totalTd, paymentTd, statusTd, dateTd);
    body.appendChild(tr);
  });
}

function initOrdersSearch() {
  const input = document.querySelector("[data-orders-search]");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { paintOrders(allOrders); return; }
    paintOrders(allOrders.filter(o =>
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q)
    ));
  });
}

/* ---------- Inquiries panel ---------- */
async function loadInquiries() {
  const body = document.querySelector("[data-inquiries-body]");
  const result = await window.DivaAdmin.adminFetchInquiries();

  if (!result.ok) {
    body.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "admin-empty";
    td.textContent = "Couldn't load inquiries: " + (result.error || "unknown error");
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  allInquiries = result.inquiries;
  paintInquiries(allInquiries);

  const badge = document.querySelector("[data-inquiries-badge]");
  if (allInquiries.length > 0) { badge.textContent = allInquiries.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

function paintInquiries(list) {
  const body = document.querySelector("[data-inquiries-body]");
  body.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "admin-empty";
    td.textContent = "No inquiries yet.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  list.forEach(msg => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.setAttribute("data-label", "Name");
    nameTd.textContent = msg.name;

    const emailTd = document.createElement("td");
    emailTd.setAttribute("data-label", "Email");
    emailTd.textContent = msg.email;

    const subjectTd = document.createElement("td");
    subjectTd.setAttribute("data-label", "Subject");
    subjectTd.textContent = msg.subject || "—";

    const messageTd = document.createElement("td");
    messageTd.classList.add("u-meta-line-wrap");
    messageTd.setAttribute("data-label", "Message");
    messageTd.textContent = msg.message;

    const dateTd = document.createElement("td");
    dateTd.classList.add("u-meta-date");
    dateTd.setAttribute("data-label", "Received");
    dateTd.textContent = formatDate(msg.created_at);

    tr.append(nameTd, emailTd, subjectTd, messageTd, dateTd);
    body.appendChild(tr);
  });
}

function initInquiriesSearch() {
  const input = document.querySelector("[data-inquiries-search]");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { paintInquiries(allInquiries); return; }
    paintInquiries(allInquiries.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    ));
  });
}

/* ---------- Toast (simple local version, no dependency on main.js) ---------- */
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------- Products panel ---------- */
let allProducts = [];
let pendingUploadedImageUrls = []; // stores up to 5 image URLs

const DEFAULT_CATEGORIES = [
  "Necklaces", "Rings", "Bracelets", "Earrings", "Sets", 
  "GET 5 FOR 999", "10% DISCOUNT", "20% DISCOUNT"
];

function populateCategoryDropdown(additionalCategory = null) {
  const select = document.querySelector('select[data-field="category"]');
  if(!select) return;
  const currentVal = select.value;
  
  const uniqueCats = new Set(DEFAULT_CATEGORIES);
  allProducts.forEach(p => {
    if(p.category) uniqueCats.add(p.category);
  });
  if(additionalCategory) uniqueCats.add(additionalCategory);
  
  select.innerHTML = '<option value="" disabled selected>Select a category</option>';
  
  Array.from(uniqueCats).sort().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  
  if (additionalCategory) {
    select.value = additionalCategory;
  } else if (currentVal && uniqueCats.has(currentVal)) {
    select.value = currentVal;
  }
}

async function loadProducts() {
  const body = document.querySelector("[data-products-body]");
  const result = await window.DivaAdmin.adminFetchProducts();

  if (!result.ok) {
    body.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "admin-empty";
    td.textContent = "Couldn't load products: " + (result.error || "unknown error");
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  allProducts = result.products;
  populateCategoryDropdown();
  paintProducts(allProducts);

  const badge = document.querySelector("[data-products-badge]");
  if (allProducts.length > 0) { badge.textContent = allProducts.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

function paintProducts(list) {
  const body = document.querySelector("[data-products-body]");
  body.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "admin-empty";
    td.textContent = "No products yet — add your first one.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  list.forEach(product => {
    const tr = document.createElement("tr");

    const imgTd = document.createElement("td");
    imgTd.setAttribute("data-label", "Image");
    const img = document.createElement("img");
    img.className = "admin-product-thumb";
    img.src = product.image_url || "../assets/logo.png";
    img.alt = product.name;
    imgTd.appendChild(img);
    if (product.video_url) {
      const vBadge = document.createElement("span");
      vBadge.className = "admin-video-badge";
      vBadge.textContent = "▶ video";
      imgTd.appendChild(vBadge);
    }

    const nameTd = document.createElement("td");
    nameTd.setAttribute("data-label", "Name");
    const strong = document.createElement("strong");
    strong.textContent = product.name;
    nameTd.appendChild(strong);

    const catTd = document.createElement("td");
    catTd.setAttribute("data-label", "Category");
    catTd.textContent = product.category;

    const priceTd = document.createElement("td");
    priceTd.setAttribute("data-label", "Price");
    priceTd.textContent = inr(product.price) + (product.compare_at ? " " : "");
    if (product.compare_at) {
      const was = document.createElement("span");
      was.classList.add("u-strike");
      was.textContent = inr(product.compare_at);
      priceTd.appendChild(was);
    }

    const statusTd = document.createElement("td");
    statusTd.setAttribute("data-label", "Status");
    const statusSpan = document.createElement("span");
    statusSpan.className = "badge-status " + (product.active ? "badge-active" : "badge-hidden");
    statusSpan.textContent = product.active ? "Visible" : "Hidden";
    statusTd.appendChild(statusSpan);

    const updatedTd = document.createElement("td");
    updatedTd.classList.add("u-meta-date");
    updatedTd.setAttribute("data-label", "Updated");
    updatedTd.textContent = formatDate(product.updated_at || product.created_at);

    const actionsTd = document.createElement("td");
    actionsTd.className = "admin-product-actions";
    actionsTd.setAttribute("data-label", "Actions");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "admin-icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openProductModal(product));
    
    const outOfStockBtn = document.createElement("button");
    outOfStockBtn.type = "button";
    outOfStockBtn.className = "admin-icon-btn";
    outOfStockBtn.textContent = product.out_of_stock ? "In Stock" : "OOS";
    if (product.out_of_stock) outOfStockBtn.classList.add("danger");
    outOfStockBtn.addEventListener("click", async () => {
      const newState = !product.out_of_stock;
      if (!confirm(`Mark "${product.name}" as ${newState ? 'Out of Stock' : 'In Stock'}?`)) return;
      outOfStockBtn.disabled = true;
      const res = await window.DivaAdmin.adminUpdateProduct(product.id, { out_of_stock: newState });
      if (res.ok) {
        showToast(`"${product.name}" is now ${newState ? 'Out of Stock' : 'In Stock'}`);
        loadProducts();
      } else {
        outOfStockBtn.disabled = false;
        showToast("Couldn't update stock status: " + (res.error || "unknown error"));
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "admin-icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteProduct(product));
    actionsTd.append(editBtn, outOfStockBtn, deleteBtn);

    tr.append(imgTd, nameTd, catTd, priceTd, statusTd, updatedTd, actionsTd);
    body.appendChild(tr);
  });
}

function initProductsSearch() {
  const input = document.querySelector("[data-products-search]");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { paintProducts(allProducts); return; }
    paintProducts(allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    ));
  });
}

/* ---------- Product modal (add / edit) ---------- */
function getProductForm() { return document.querySelector("[data-product-form]"); }

function openProductModal(product) {
  const modal = document.querySelector("[data-product-modal]");
  const form = getProductForm();
  form.reset();
  pendingUploadedImageUrls = [];
  document.querySelector("[data-upload-status]").textContent = "";
  document.querySelector("[data-video-upload-status]").textContent = "";
  document.querySelector("[data-product-form-status]").textContent = "";
  document.querySelector("[data-product-form-status]").className = "form-status";

  populateCategoryDropdown();

  const gallery = document.querySelector("[data-image-gallery]");
  const videoPreview = document.querySelector("[data-video-preview]");

  function renderGallery() {
    gallery.innerHTML = "";
    pendingUploadedImageUrls.forEach((url, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "gallery-item";
      wrapper.style.position = "relative";
      wrapper.style.display = "inline-block";
      wrapper.style.marginRight = "8px";
      wrapper.style.marginBottom = "8px";
      
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "4px";
      
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.className = "remove-img-btn";
      removeBtn.style.position = "absolute";
      removeBtn.style.top = "-5px";
      removeBtn.style.right = "-5px";
      removeBtn.style.background = "#ff4d4f";
      removeBtn.style.color = "#fff";
      removeBtn.style.border = "none";
      removeBtn.style.borderRadius = "50%";
      removeBtn.style.width = "20px";
      removeBtn.style.height = "20px";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.fontSize = "14px";
      removeBtn.style.lineHeight = "1";
      removeBtn.onclick = () => {
        pendingUploadedImageUrls.splice(idx, 1);
        renderGallery();
        form.querySelector('[data-field="imageUrl"]').value = pendingUploadedImageUrls[0] || "";
      };
      
      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      gallery.appendChild(wrapper);
    });
  }

  // Allow manual entry to add to array
  const imageUrlInput = form.querySelector('[data-field="imageUrl"]');
  // Overwrite listener below clears it
  const newListener = (e) => {
    const val = e.target.value.trim();
    if (val && !pendingUploadedImageUrls.includes(val) && pendingUploadedImageUrls.length < 5) {
        pendingUploadedImageUrls[0] = val; // Set primary
        renderGallery();
    }
  };
  imageUrlInput.removeEventListener("input", imageUrlInput._listener || function(){});
  imageUrlInput._listener = newListener;
  imageUrlInput.addEventListener("input", newListener);

  if (product) {
    document.querySelector("[data-product-modal-title]").textContent = "Edit Product";
    form.querySelector('[data-field="id"]').value = product.id;
    form.querySelector('[data-field="name"]').value = product.name;
    form.querySelector('[data-field="category"]').value = product.category;
    form.querySelector('[data-field="active"]').checked = !!product.active;
    form.querySelector('[data-field="tagTrending"]').checked = !!product.is_trending;
    form.querySelector('[data-field="tagBestSeller"]').checked = !!product.is_bestseller;
    form.querySelector('[data-field="tagPromotional"]').checked = !!product.is_promotional;
    form.querySelector('[data-field="price"]').value = product.price;
    form.querySelector('[data-field="compareAt"]').value = product.compare_at ?? "";
    form.querySelector('[data-field="videoUrl"]').value = product.video_url || "";
    form.querySelector('[data-field="description"]').value = product.description || "";
    
    pendingUploadedImageUrls = product.image_urls && product.image_urls.length > 0 ? [...product.image_urls] : (product.image_url ? [product.image_url] : []);
    form.querySelector('[data-field="imageUrl"]').value = pendingUploadedImageUrls[0] || "";
    renderGallery();

    if (product.video_url) { videoPreview.src = product.video_url; videoPreview.classList.remove("hidden"); }
    else videoPreview.classList.add("hidden");
  } else {
    document.querySelector("[data-product-modal-title]").textContent = "Add Product";
    form.querySelector('[data-field="id"]').value = "";
    form.querySelector('[data-field="active"]').checked = true;
    form.querySelector('[data-field="tagTrending"]').checked = false;
    form.querySelector('[data-field="tagBestSeller"]').checked = false;
    form.querySelector('[data-field="tagPromotional"]').checked = false;
    renderGallery();
    videoPreview.classList.add("hidden");
  }

  modal.classList.remove("hidden");
}

function closeProductModal() {
  document.querySelector("[data-product-modal]").classList.add("hidden");
}

async function deleteProduct(product) {
  if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
  const res = await window.DivaAdmin.adminDeleteProduct(product.id);
  if (res.ok) {
    showToast(`"${product.name}" deleted`);
    loadProducts();
  } else {
    showToast("Couldn't delete: " + (res.error || "unknown error"));
  }
}

function initProductModal() {
  document.querySelector("[data-add-product-btn]").addEventListener("click", () => openProductModal(null));
  document.querySelectorAll("[data-product-modal-close]").forEach(btn => btn.addEventListener("click", closeProductModal));
  document.querySelector("[data-product-modal]").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  document.getElementById("add-category-btn")?.addEventListener("click", () => {
    const newCat = prompt("Enter new category name (e.g. 30% DISCOUNT):");
    if (newCat && newCat.trim()) {
      populateCategoryDropdown(newCat.trim());
    }
  });

  // Image upload → Supabase Storage, fills the URL field + preview.
  document.querySelector("[data-image-file]").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (pendingUploadedImageUrls.length + files.length > 5) {
      showToast("You can upload a maximum of 5 images per product.");
      e.target.value = "";
      return;
    }
    
    const status = document.querySelector("[data-upload-status]");
    status.textContent = `Uploading ${files.length} image(s)…`;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await window.DivaAdmin.adminUploadProductImage(file);
        if (res.ok) {
          pendingUploadedImageUrls.push(res.url);
        } else {
          status.textContent = `Upload failed for ${file.name}: ` + (res.error || "unknown error");
          e.target.value = "";
          return;
        }
    }
    
    getProductForm().querySelector('[data-field="imageUrl"]').value = pendingUploadedImageUrls[0] || "";
    
    // Re-render gallery
    const gallery = document.querySelector("[data-image-gallery]");
    gallery.innerHTML = "";
    pendingUploadedImageUrls.forEach((url, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "gallery-item";
      wrapper.style.position = "relative";
      wrapper.style.display = "inline-block";
      wrapper.style.marginRight = "8px";
      wrapper.style.marginBottom = "8px";
      
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "4px";
      
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.className = "remove-img-btn";
      removeBtn.style.position = "absolute";
      removeBtn.style.top = "-5px";
      removeBtn.style.right = "-5px";
      removeBtn.style.background = "#ff4d4f";
      removeBtn.style.color = "#fff";
      removeBtn.style.border = "none";
      removeBtn.style.borderRadius = "50%";
      removeBtn.style.width = "20px";
      removeBtn.style.height = "20px";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.fontSize = "14px";
      removeBtn.style.lineHeight = "1";
      removeBtn.onclick = () => {
        pendingUploadedImageUrls.splice(idx, 1);
        gallery.removeChild(wrapper);
        getProductForm().querySelector('[data-field="imageUrl"]').value = pendingUploadedImageUrls[0] || "";
      };
      
      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      gallery.appendChild(wrapper);
    });

    status.textContent = "Uploaded ✓";
    e.target.value = "";
  });

  // Video upload → Supabase Storage, fills the URL field + preview.
  document.querySelector("[data-video-file]").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.querySelector("[data-video-upload-status]");
    status.textContent = "Uploading…";
    const res = await window.DivaAdmin.adminUploadProductVideo(file);
    if (res.ok) {
      getProductForm().querySelector('[data-field="videoUrl"]').value = res.url;
      const preview = document.querySelector("[data-video-preview]");
      preview.src = res.url;
      preview.classList.remove("hidden");
      status.textContent = "Uploaded ✓";
    } else {
      status.textContent = "Upload failed: " + (res.error || "unknown error");
    }
    e.target.value = "";
  });

  // Live preview when a video URL is pasted by hand.
  getProductForm().querySelector('[data-field="videoUrl"]').addEventListener("input", (e) => {
    const preview = document.querySelector("[data-video-preview]");
    if (e.target.value.trim()) { preview.src = e.target.value.trim(); preview.classList.remove("hidden"); }
    else preview.classList.add("hidden");
  });

  getProductForm().addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = getProductForm();
    const statusEl = document.querySelector("[data-product-form-status]");
    const saveBtn = document.querySelector("[data-product-save-btn]");

    const id = form.querySelector('[data-field="id"]').value;
    const name = form.querySelector('[data-field="name"]').value.trim();
    const category = form.querySelector('[data-field="category"]').value.trim();
    const price = Number(form.querySelector('[data-field="price"]').value);
    const compareAtRaw = form.querySelector('[data-field="compareAt"]').value;
    const compareAt = compareAtRaw === "" ? null : Number(compareAtRaw);
    const imageUrl = form.querySelector('[data-field="imageUrl"]').value.trim();
    const videoUrl = form.querySelector('[data-field="videoUrl"]').value.trim();
    const description = form.querySelector('[data-field="description"]').value.trim();
    const active = form.querySelector('[data-field="active"]').checked;
    
    const is_trending = form.querySelector('[data-field="tagTrending"]').checked;
    const is_bestseller = form.querySelector('[data-field="tagBestSeller"]').checked;
    const is_promotional = form.querySelector('[data-field="tagPromotional"]').checked;

    if (!name || !category || !Number.isFinite(price) || price < 0) {
      statusEl.textContent = "Please fill in a name, category, and a valid price.";
      statusEl.className = "form-status show err";
      return;
    }

    const payload = {
      name, category, price,
      compare_at: compareAt,
      image_url: pendingUploadedImageUrls[0] || "",
      image_urls: pendingUploadedImageUrls,
      video_url: videoUrl || null,
      description,
      active,
      is_trending,
      is_bestseller,
      is_promotional
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const res = id
      ? await window.DivaAdmin.adminUpdateProduct(id, payload)
      : await window.DivaAdmin.adminCreateProduct(payload);

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Product";

    if (res.ok) {
      showToast(id ? `"${name}" updated` : `"${name}" added`);
      closeProductModal();
      loadProducts();
    } else {
      statusEl.textContent = "Couldn't save: " + (res.error || "unknown error");
      statusEl.className = "form-status show err";
    }
  });
}

/* ---------- Hero Videos panel ---------- */
let allHeroVideos = [];
const fallbackVideos = [
  { id: "mock-1", sort_order: 1, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", poster_url: "https://images.unsplash.com/photo-1569397288884-4d43d6738fbd?auto=format&fit=crop&w=500&q=80" },
  { id: "mock-2", sort_order: 2, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", poster_url: "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=500&q=80" },
  { id: "mock-3", sort_order: 3, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", poster_url: "https://images.unsplash.com/photo-1631982690223-8aa4be0a2497?auto=format&fit=crop&w=500&q=80" },
  { id: "mock-4", sort_order: 4, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4", poster_url: "https://images.unsplash.com/photo-1650455221359-3aebf920bcc5?auto=format&fit=crop&w=500&q=80" },
  { id: "mock-5", sort_order: 5, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4", poster_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=500&q=80" },
  { id: "mock-6", sort_order: 6, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", poster_url: "https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&w=500&q=80" },
  { id: "mock-7", sort_order: 7, video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4", poster_url: "https://images.unsplash.com/photo-1599643478524-fb66f7ca066b?auto=format&fit=crop&w=500&q=80" }
];

async function loadHeroVideos() {
  const body = document.querySelector("[data-videos-body]");
  if (!body) return;
  const result = await window.DivaAdmin.adminFetchHeroVideos();

  let videos = [];
  if (result.ok && result.videos && result.videos.length > 0) {
    videos = result.videos;
  } else {
    videos = fallbackVideos;
  }

  allHeroVideos = videos;
  paintHeroVideos(allHeroVideos);
}

function paintHeroVideos(list) {
  const body = document.querySelector("[data-videos-body]");
  body.innerHTML = "";
  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "admin-empty";
    td.textContent = "No hero videos found.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  list.forEach(v => {
    let catClass = "vid-cat-promo";
    let catName = "Promotion";
    let title = "Special Occasion Edit";
    const sort = Number(v.sort_order);
    if(sort === 1) { catClass = "vid-cat-home"; catName = "Home Banner"; title = "Timeless Collection"; }
    else if(sort === 2) { catClass = "vid-cat-story"; catName = "Our Story"; title = "Behind The Craft"; }
    else if(sort === 3) { catClass = "vid-cat-collection"; catName = "Collection"; title = "New Arrivals"; }
    else if(sort === 4) { catClass = "vid-cat-about"; catName = "About Us"; title = "Crafted To Perfection"; }

    const dateStr = formatDate(v.created_at || new Date().toISOString()).split(' · ')[0];

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Preview" style="padding-left:24px;">
        <div class="vid-preview-wrap vid-preview-clickable" data-video-src="${v.video_url}" title="Click to preview">
          <video src="${v.video_url}" poster="${v.poster_url || ''}" muted loop playsinline></video>
          <div class="vid-play-icon">
             <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="vid-preview-overlay">Preview</div>
        </div>
      </td>
      <td data-label="Title">
        <div class="vid-title">${title}</div>
        <div class="vid-meta">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-top:-1px;"><path d="M12 19V9M8 13l4-4 4 4M20 16.5a4.5 4.5 0 00-3-8h-.3a7 7 0 00-13.4 2A4.5 4.5 0 005.5 19h11z"/></svg>
          Uploaded on ${dateStr}
        </div>
      </td>
      <td data-label="Category">
        <span class="vid-category-pill ${catClass}">${catName}</span>
      </td>
      <td data-label="Duration">
        <div class="vid-meta" style="font-size:.85rem; color:#4a4a4a;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          00:15
        </div>
      </td>
      <td data-label="Status">
        <span class="vid-status-pill vid-status-active">Active</span>
      </td>
      <td data-label="Actions" style="padding-right:24px;">
        <div class="vid-actions-wrap">
          <button type="button" class="vid-icon-btn admin-edit-btn" data-id="${v.id}" title="Edit">
             <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <div class="vid-toggle-wrap">
            <label class="vid-toggle">
              <input type="checkbox" checked>
              <span class="vid-slider"></span>
            </label>
            <span class="vid-toggle-label">Visibility</span>
          </div>
          <button type="button" class="vid-icon-btn danger admin-del-btn" data-id="${v.id}" title="Delete">
             <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>
    `;
    // Video preview click → lightbox
    tr.querySelector(".vid-preview-clickable").addEventListener("click", () => {
      openAdminVideoLightbox(v.video_url, v.poster_url, title);
    });
    tr.querySelector(".admin-edit-btn").addEventListener("click", () => {
      if(window.openVideoModal) window.openVideoModal(v);
    });
    tr.querySelector(".admin-del-btn").addEventListener("click", async () => {
      if(!confirm("Delete this video?")) return;
      if(String(v.id).startsWith("mock-")) {
        alert("This is a demo video. Add a new video to replace the demo ones!");
        return;
      }
      const res = await window.DivaAdmin.adminDeleteHeroVideo(v.id);
      if(res.ok){
        showToast("Video deleted");
        loadHeroVideos();
      } else {
        alert("Couldn't delete: " + res.error);
      }
    });
    // Autoplay preview on hover
    const vidEl = tr.querySelector("video");
    tr.addEventListener("mouseenter", () => vidEl.play().catch(()=>{}));
    tr.addEventListener("mouseleave", () => { vidEl.pause(); vidEl.currentTime = 0; });
    body.appendChild(tr);
  });
}

function openAdminVideoLightbox(videoSrc, posterSrc, title) {
  let lightbox = document.getElementById('admin-video-lightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'admin-video-lightbox';
    lightbox.className = 'admin-lightbox-overlay';
    lightbox.innerHTML = `
      <div class="admin-lightbox-content">
        <button type="button" class="admin-lightbox-close" title="Close">&times;</button>
        <div class="admin-lightbox-header"></div>
        <video controls playsinline autoplay></video>
      </div>
    `;
    document.body.appendChild(lightbox);

    lightbox.querySelector('.admin-lightbox-close').addEventListener('click', () => {
      lightbox.classList.remove('active');
      lightbox.querySelector('video').pause();
    });
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        lightbox.classList.remove('active');
        lightbox.querySelector('video').pause();
      }
    });
  }

  const vidEl = lightbox.querySelector('video');
  vidEl.src = videoSrc;
  if (posterSrc) vidEl.poster = posterSrc;
  lightbox.querySelector('.admin-lightbox-header').textContent = title || 'Video Preview';
  
  lightbox.classList.add('active');
}

function initVideoModal() {
  const modal = document.querySelector("[data-video-modal]");
  if (!modal) return;
  const form = document.querySelector("[data-video-form]");
  const statusEl = document.querySelector("[data-video-form-status]");

  const openBtn = document.querySelector("[data-video-add-btn]");
  const closeBtns = document.querySelectorAll("[data-video-modal-close]");

  let pendingVideoFile = null;
  let pendingPosterFile = null;

  function openModal(video = null) {
    pendingVideoFile = null;
    pendingPosterFile = null;
    const vidStatus = document.querySelector("[data-hero-video-upload-status]");
    if (vidStatus) vidStatus.textContent = "";
    const posterStatus = document.querySelector("[data-hero-poster-upload-status]");
    if (posterStatus) posterStatus.textContent = "";

    form.reset();
    statusEl.className = "form-status";

    const vidPreview = document.querySelector("[data-hero-video-preview]");
    const posterPreview = document.querySelector("[data-hero-poster-preview]");

    if (video && video.id) {
      // If it's a mock video, clear the ID so saving it creates a real row
      form.querySelector('[data-video-field="id"]').value = String(video.id).startsWith("mock-") ? "" : video.id;
      form.querySelector('[data-video-field="video_url"]').value = video.video_url || "";
      form.querySelector('[data-video-field="poster_url"]').value = video.poster_url || "";
      form.querySelector('[data-video-field="sort_order"]').value = video.sort_order || 0;

      if (video.video_url && vidPreview) { 
        vidPreview.src = video.video_url; 
        vidPreview.classList.remove("hidden");
        vidPreview.parentElement.classList.remove("hidden"); 
      } else if (vidPreview) {
        vidPreview.classList.add("hidden");
        if(vidPreview.parentElement.classList.contains("modal-vid-preview-box")) vidPreview.parentElement.classList.add("hidden");
      }

      if (video.poster_url && posterPreview) { 
        posterPreview.src = video.poster_url; 
        posterPreview.classList.remove("hidden");
        posterPreview.parentElement.classList.remove("hidden"); 
      } else if (posterPreview) {
        posterPreview.classList.add("hidden");
        if(posterPreview.parentElement.classList.contains("modal-vid-preview-box")) posterPreview.parentElement.classList.add("hidden");
      }
    } else {
      form.querySelector('[data-video-field="id"]').value = "";
      if (vidPreview) {
        vidPreview.classList.add("hidden");
        if(vidPreview.parentElement.classList.contains("modal-vid-preview-box")) vidPreview.parentElement.classList.add("hidden");
      }
      if (posterPreview) {
        posterPreview.classList.add("hidden");
        if(posterPreview.parentElement.classList.contains("modal-vid-preview-box")) posterPreview.parentElement.classList.add("hidden");
      }
    }
    modal.classList.remove("hidden");
  }
  function closeModal() {
    modal.classList.add("hidden");
  }

  window.openVideoModal = openModal;

  if (openBtn) openBtn.addEventListener("click", () => openModal());
  closeBtns.forEach(b => b.addEventListener("click", closeModal));

  const videoFileInput = document.querySelector("[data-hero-video-file]");
  if (videoFileInput) {
    videoFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingVideoFile = file;
      const status = document.querySelector("[data-hero-video-upload-status]");
      status.textContent = "Selected (will upload on save)";
      
      const localUrl = URL.createObjectURL(file);
      const preview = document.querySelector("[data-hero-video-preview]");
      if (preview) { 
        preview.src = localUrl; 
        preview.classList.remove("hidden");
        preview.parentElement.classList.remove("hidden"); 
        preview.play().catch(()=>{});
      }
      // Don't upload yet!
    });
  }

  const posterFileInput = document.querySelector("[data-hero-poster-file]");
  if (posterFileInput) {
    posterFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingPosterFile = file;
      const status = document.querySelector("[data-hero-poster-upload-status]");
      status.textContent = "Selected (will upload on save)";
      
      const localUrl = URL.createObjectURL(file);
      const preview = document.querySelector("[data-hero-poster-preview]");
      if (preview) { 
        preview.src = localUrl; 
        preview.classList.remove("hidden");
        preview.parentElement.classList.remove("hidden"); 
      }
      // Don't upload yet!
    });
  }

  // Live preview when a URL is pasted by hand
  const vidUrlInput = form.querySelector('[data-video-field="video_url"]');
  if (vidUrlInput) {
    vidUrlInput.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      const preview = document.querySelector("[data-hero-video-preview]");
      const status = document.querySelector("[data-video-form-status]");
      
      if (url.includes("instagram.com")) {
        if (status) {
          status.textContent = "Instagram links cannot be previewed or autoplayed seamlessly. Please download the reel and upload the raw MP4 file below for the best experience.";
          status.className = "form-status show err";
        }
      } else if (status) {
        status.className = "form-status";
      }

      if (preview) {
        if (url) { 
          preview.src = url; 
          preview.classList.remove("hidden");
          preview.parentElement.classList.remove("hidden");
          preview.play().catch(()=>{});
        } else {
          preview.classList.add("hidden");
          if(preview.parentElement.classList.contains("modal-vid-preview-box")) preview.parentElement.classList.add("hidden");
        }
      }
    });
  }

  const posterUrlInput = form.querySelector('[data-video-field="poster_url"]');
  if (posterUrlInput) {
    posterUrlInput.addEventListener("input", (e) => {
      const preview = document.querySelector("[data-hero-poster-preview]");
      if (preview) {
        if (e.target.value.trim()) { preview.src = e.target.value.trim(); preview.parentElement.classList.remove("hidden"); }
        else preview.parentElement.classList.add("hidden");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.className = "form-status";

    const id = form.querySelector('[data-video-field="id"]').value;
    let videoUrl = form.querySelector('[data-video-field="video_url"]').value.trim();
    let posterUrl = form.querySelector('[data-video-field="poster_url"]').value.trim();
    const sortOrder = parseInt(form.querySelector('[data-video-field="sort_order"]').value) || 0;

    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = "Uploading & Saving…";

    if (pendingVideoFile) {
      statusEl.textContent = "Uploading video to Cloudinary...";
      statusEl.className = "form-status show";
      const res = await window.DivaAdmin.adminUploadProductVideo(pendingVideoFile);
      if (res.ok) {
        videoUrl = res.url;
      } else {
        statusEl.textContent = "Video upload failed: " + (res.error || "unknown error");
        statusEl.className = "form-status show err";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Video";
        return;
      }
    }

    if (pendingPosterFile) {
      statusEl.textContent = "Uploading poster to Cloudinary...";
      statusEl.className = "form-status show";
      const res = await window.DivaAdmin.adminUploadProductImage(pendingPosterFile);
      if (res.ok) {
        posterUrl = res.url;
      } else {
        statusEl.textContent = "Poster upload failed: " + (res.error || "unknown error");
        statusEl.className = "form-status show err";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Video";
        return;
      }
    }

    if (!videoUrl) {
      statusEl.textContent = "Please provide a Video URL or upload a file.";
      statusEl.className = "form-status show err";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Video";
      return;
    }

    const payload = {
      video_url: videoUrl,
      poster_url: posterUrl || "",
      sort_order: sortOrder
    };

    // saveBtn already disabled and styled in the previous step


    const res = id
      ? await window.DivaAdmin.adminUpdateHeroVideo(id, payload)
      : await window.DivaAdmin.adminCreateHeroVideo(payload);

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Video";

    if (res.ok) {
      showToast("Video saved");
      closeModal();
      loadHeroVideos();
    } else {
      statusEl.textContent = "Couldn't save: " + (res.error || "unknown error");
      statusEl.className = "form-status show err";
    }
  });
}

/* ---------- Sign out ---------- */
function initSignOut() {
  document.querySelector("#admin-signout-btn").addEventListener("click", async () => {
    await window.DivaAdmin.adminSignOut();
    window.location.href = "login.html";
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await guardAdminAccess();
  if (!ok) return;

  initPanelNav();
  initMobileNav();
  initOrdersSearch();
  initInquiriesSearch();
  initProductsSearch();
  initProductModal();
  initVideoModal();
  initSignOut();

  loadOrders();
  loadInquiries();
  loadProducts();
  loadHeroVideos();
});
