/* ============================================================
   DIVA JEWELS — Admin dashboard app logic
   ============================================================ */

const ORDER_STATUSES = [
  { value: "received",         label: "Received" },          // ongoing
  { value: "processing",       label: "Processing" },        // ongoing
  { value: "shipped",          label: "Shipped" },           // on route
  { value: "out_for_delivery", label: "Out for Delivery" },  // on route
  { value: "delivered",        label: "Delivered" },
  { value: "cancelled",        label: "Cancelled" },
];

let allOrders = [];
let allInquiries = [];

/* ---------- Auth guard ---------- */
async function guardAdminAccess(){
  const check = await window.DivaAdmin.adminCheckSession();

  if(!check.ok || !check.user){
    window.location.href = "login.html";
    return false;
  }
  if(!check.isAdmin){
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
function initPanelNav(){
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

/* ---------- Formatting helpers ---------- */
function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
         " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function inr(n){ return "₹" + Number(n).toLocaleString("en-IN"); }
function statusLabel(value){
  const found = ORDER_STATUSES.find(s => s.value === value);
  return found ? found.label : value;
}

/* ---------- Orders panel ---------- */
async function loadOrders(){
  const body = document.querySelector("[data-orders-body]");
  const result = await window.DivaAdmin.adminFetchOrders();

  if(!result.ok){
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
  if(pendingCount > 0){ badge.textContent = pendingCount; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

function renderOrderStats(){
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

function paintOrders(list){
  const body = document.querySelector("[data-orders-body]");
  body.innerHTML = "";

  if(list.length === 0){
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
    orderNumTd.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = order.order_number;
    orderNumTd.appendChild(strong);

    const custTd = document.createElement("td");
    const nameDiv = document.createElement("div");
    nameDiv.textContent = order.customer_name;
    const emailDiv = document.createElement("div");
    emailDiv.style.cssText = "font-size:.78rem;color:var(--ink-soft);";
    emailDiv.textContent = order.customer_email;
    const phoneDiv = document.createElement("div");
    phoneDiv.style.cssText = "font-size:.78rem;color:var(--ink-soft);";
    phoneDiv.textContent = order.customer_phone;
    custTd.append(nameDiv, emailDiv, phoneDiv);

    const itemsTd = document.createElement("td");
    itemsTd.className = "admin-order-items";
    (order.items || []).forEach(item => {
      const div = document.createElement("div");
      div.textContent = `${item.qty}× ${item.name}`;
      itemsTd.appendChild(div);
    });

    const addrTd = document.createElement("td");
    addrTd.className = "admin-order-addr";
    addrTd.textContent = `${order.address_line1}${order.address_line2 ? ", " + order.address_line2 : ""}, ${order.city}, ${order.state} ${order.pincode}`;

    const totalTd = document.createElement("td");
    totalTd.textContent = inr(order.total);

    const paymentTd = document.createElement("td");
    const paySpan = document.createElement("span");
    paySpan.className = "badge-status badge-" + order.payment_status;
    paySpan.textContent = order.payment_status;
    paymentTd.appendChild(paySpan);

    const statusTd = document.createElement("td");
    const select = document.createElement("select");
    select.className = "status-select";
    ORDER_STATUSES.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      if(s.value === order.order_status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", async () => {
      const prev = order.order_status;
      select.disabled = true;
      const res = await window.DivaAdmin.adminUpdateOrderStatus(order.id, select.value);
      select.disabled = false;
      if(res.ok){
        order.order_status = select.value;
        showToast(`${order.order_number} marked "${statusLabel(select.value)}"`);
        renderOrderStats();
      }else{
        select.value = prev;
        showToast("Couldn't update status: " + (res.error || "unknown error"));
      }
    });
    statusTd.appendChild(select);

    const dateTd = document.createElement("td");
    dateTd.style.cssText = "font-size:.8rem;color:var(--ink-soft);white-space:nowrap;";
    dateTd.textContent = formatDate(order.created_at);

    tr.append(orderNumTd, custTd, itemsTd, addrTd, totalTd, paymentTd, statusTd, dateTd);
    body.appendChild(tr);
  });
}

function initOrdersSearch(){
  const input = document.querySelector("[data-orders-search]");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if(!q){ paintOrders(allOrders); return; }
    paintOrders(allOrders.filter(o =>
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q)
    ));
  });
}

/* ---------- Inquiries panel ---------- */
async function loadInquiries(){
  const body = document.querySelector("[data-inquiries-body]");
  const result = await window.DivaAdmin.adminFetchInquiries();

  if(!result.ok){
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
  if(allInquiries.length > 0){ badge.textContent = allInquiries.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

function paintInquiries(list){
  const body = document.querySelector("[data-inquiries-body]");
  body.innerHTML = "";

  if(list.length === 0){
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
    nameTd.textContent = msg.name;

    const emailTd = document.createElement("td");
    emailTd.textContent = msg.email;

    const subjectTd = document.createElement("td");
    subjectTd.textContent = msg.subject || "—";

    const messageTd = document.createElement("td");
    messageTd.style.cssText = "max-width:320px;white-space:pre-wrap;";
    messageTd.textContent = msg.message;

    const dateTd = document.createElement("td");
    dateTd.style.cssText = "font-size:.8rem;color:var(--ink-soft);white-space:nowrap;";
    dateTd.textContent = formatDate(msg.created_at);

    tr.append(nameTd, emailTd, subjectTd, messageTd, dateTd);
    body.appendChild(tr);
  });
}

function initInquiriesSearch(){
  const input = document.querySelector("[data-inquiries-search]");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if(!q){ paintInquiries(allInquiries); return; }
    paintInquiries(allInquiries.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    ));
  });
}

/* ---------- Toast (simple local version, no dependency on main.js) ---------- */
function showToast(message){
  let toast = document.querySelector(".toast");
  if(!toast){
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
let pendingUploadedImageUrl = null; // set after a successful file upload in the modal

async function loadProducts(){
  const body = document.querySelector("[data-products-body]");
  const result = await window.DivaAdmin.adminFetchProducts();

  if(!result.ok){
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
  paintProducts(allProducts);

  const badge = document.querySelector("[data-products-badge]");
  if(allProducts.length > 0){ badge.textContent = allProducts.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

function paintProducts(list){
  const body = document.querySelector("[data-products-body]");
  body.innerHTML = "";

  if(list.length === 0){
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
    const img = document.createElement("img");
    img.className = "admin-product-thumb";
    img.src = product.image_url || "../assets/logo.png";
    img.alt = product.name;
    imgTd.appendChild(img);

    const nameTd = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = product.name;
    nameTd.appendChild(strong);

    const catTd = document.createElement("td");
    catTd.textContent = product.category;

    const priceTd = document.createElement("td");
    priceTd.textContent = inr(product.price) + (product.compare_at ? " " : "");
    if(product.compare_at){
      const was = document.createElement("span");
      was.style.cssText = "text-decoration:line-through;color:var(--ink-soft);font-size:.78rem;margin-left:6px;";
      was.textContent = inr(product.compare_at);
      priceTd.appendChild(was);
    }

    const statusTd = document.createElement("td");
    const statusSpan = document.createElement("span");
    statusSpan.className = "badge-status " + (product.active ? "badge-active" : "badge-hidden");
    statusSpan.textContent = product.active ? "Visible" : "Hidden";
    statusTd.appendChild(statusSpan);

    const updatedTd = document.createElement("td");
    updatedTd.style.cssText = "font-size:.8rem;color:var(--ink-soft);white-space:nowrap;";
    updatedTd.textContent = formatDate(product.updated_at || product.created_at);

    const actionsTd = document.createElement("td");
    actionsTd.className = "admin-product-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "admin-icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openProductModal(product));
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "admin-icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteProduct(product));
    actionsTd.append(editBtn, deleteBtn);

    tr.append(imgTd, nameTd, catTd, priceTd, statusTd, updatedTd, actionsTd);
    body.appendChild(tr);
  });
}

function initProductsSearch(){
  const input = document.querySelector("[data-products-search]");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if(!q){ paintProducts(allProducts); return; }
    paintProducts(allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    ));
  });
}

/* ---------- Product modal (add / edit) ---------- */
function getProductForm(){ return document.querySelector("[data-product-form]"); }

function openProductModal(product){
  const modal = document.querySelector("[data-product-modal]");
  const form = getProductForm();
  form.reset();
  pendingUploadedImageUrl = null;
  document.querySelector("[data-upload-status]").textContent = "";
  document.querySelector("[data-product-form-status]").textContent = "";
  document.querySelector("[data-product-form-status]").className = "form-status";

  const preview = document.querySelector("[data-image-preview]");

  if(product){
    document.querySelector("[data-product-modal-title]").textContent = "Edit Product";
    form.querySelector('[data-field="id"]').value = product.id;
    form.querySelector('[data-field="name"]').value = product.name;
    form.querySelector('[data-field="category"]').value = product.category;
    form.querySelector('[data-field="active"]').checked = !!product.active;
    form.querySelector('[data-field="price"]').value = product.price;
    form.querySelector('[data-field="compareAt"]').value = product.compare_at ?? "";
    form.querySelector('[data-field="imageUrl"]').value = product.image_url || "";
    form.querySelector('[data-field="description"]').value = product.description || "";
    if(product.image_url){ preview.src = product.image_url; preview.classList.remove("hidden"); }
    else preview.classList.add("hidden");
  }else{
    document.querySelector("[data-product-modal-title]").textContent = "Add Product";
    form.querySelector('[data-field="id"]').value = "";
    form.querySelector('[data-field="active"]').checked = true;
    preview.classList.add("hidden");
  }

  modal.classList.remove("hidden");
}

function closeProductModal(){
  document.querySelector("[data-product-modal]").classList.add("hidden");
}

async function deleteProduct(product){
  if(!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
  const res = await window.DivaAdmin.adminDeleteProduct(product.id);
  if(res.ok){
    showToast(`"${product.name}" deleted`);
    loadProducts();
  }else{
    showToast("Couldn't delete: " + (res.error || "unknown error"));
  }
}

function initProductModal(){
  document.querySelector("[data-add-product-btn]").addEventListener("click", () => openProductModal(null));
  document.querySelectorAll("[data-product-modal-close]").forEach(btn => btn.addEventListener("click", closeProductModal));
  document.querySelector("[data-product-modal]").addEventListener("click", (e) => {
    if(e.target === e.currentTarget) closeProductModal();
  });

  // Image upload → Supabase Storage, fills the URL field + preview.
  document.querySelector("[data-image-file]").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const status = document.querySelector("[data-upload-status]");
    status.textContent = "Uploading…";
    const res = await window.DivaAdmin.adminUploadProductImage(file);
    if(res.ok){
      pendingUploadedImageUrl = res.url;
      getProductForm().querySelector('[data-field="imageUrl"]').value = res.url;
      const preview = document.querySelector("[data-image-preview]");
      preview.src = res.url;
      preview.classList.remove("hidden");
      status.textContent = "Uploaded ✓";
    }else{
      status.textContent = "Upload failed: " + (res.error || "unknown error");
    }
    e.target.value = "";
  });

  // Live preview when a URL is pasted by hand.
  getProductForm().querySelector('[data-field="imageUrl"]').addEventListener("input", (e) => {
    const preview = document.querySelector("[data-image-preview]");
    if(e.target.value.trim()){ preview.src = e.target.value.trim(); preview.classList.remove("hidden"); }
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
    const description = form.querySelector('[data-field="description"]').value.trim();
    const active = form.querySelector('[data-field="active"]').checked;

    if(!name || !category || !Number.isFinite(price) || price < 0){
      statusEl.textContent = "Please fill in a name, category, and a valid price.";
      statusEl.className = "form-status show err";
      return;
    }

    const payload = {
      name, category, price,
      compare_at: compareAt,
      image_url: imageUrl,
      description,
      active
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const res = id
      ? await window.DivaAdmin.adminUpdateProduct(id, payload)
      : await window.DivaAdmin.adminCreateProduct(payload);

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Product";

    if(res.ok){
      showToast(id ? `"${name}" updated` : `"${name}" added`);
      closeProductModal();
      loadProducts();
    }else{
      statusEl.textContent = "Couldn't save: " + (res.error || "unknown error");
      statusEl.className = "form-status show err";
    }
  });
}

/* ---------- Sign out ---------- */
function initSignOut(){
  document.querySelector("#admin-signout-btn").addEventListener("click", async () => {
    await window.DivaAdmin.adminSignOut();
    window.location.href = "login.html";
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await guardAdminAccess();
  if(!ok) return;

  initPanelNav();
  initOrdersSearch();
  initInquiriesSearch();
  initProductsSearch();
  initProductModal();
  initSignOut();

  loadOrders();
  loadInquiries();
  loadProducts();
});
