/* ============================================================
   DIVA JEWELS — "My Orders" page (orders.html)
   Auth-gated the same way cart.html is: no session -> straight to
   login.html, remembering to come back here. Signed in -> fetch and
   render this customer's own orders (RLS already restricts the query
   to their own rows — see fetchMyOrders() in supabase-client.js).
   ============================================================ */

const ORDER_STATUS_LABELS = {
  received: "Received",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const PAYMENT_STATUS_LABELS = {
  pending: "Payment Pending",
  paid: "Paid",
  failed: "Payment Failed",
  refunded: "Refunded"
};

/* Same "ongoing / on route / delivered" grouping the admin panel uses,
   plus cancelled, for the filter pills below. */
const ORDER_FILTERS = {
  "All": null,
  "Ongoing": ["received", "processing"],
  "On Route": ["shipped", "out_for_delivery"],
  "Delivered": ["delivered"],
  "Cancelled": ["cancelled"]
};

let allOrders = [];

function orderStatusLabel(value){
  return ORDER_STATUS_LABELS[value] || value;
}

function paymentStatusLabel(value){
  return PAYMENT_STATUS_LABELS[value] || value;
}

function formatOrderDate(iso){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Adds every item from a past order back into the cart and heads to
 *  checkout. Items whose product no longer exists (deleted/deactivated
 *  since the order was placed) are skipped and called out in the toast,
 *  rather than silently failing or blocking the rest of the reorder. */
async function reorder(order){
  if(window.PRODUCTS_READY) await window.PRODUCTS_READY;

  const missing = [];
  (order.items || []).forEach(item => {
    const stillAvailable = window.PRODUCTS.some(p => p.id === item.id);
    if(stillAvailable){
      window.Cart.add(item.id, item.qty);
    }else{
      missing.push(item.name);
    }
  });

  if(missing.length === (order.items || []).length){
    window.showToast?.("Sorry, none of these items are available anymore.");
    return;
  }
  if(missing.length > 0){
    window.showToast?.(`Added to bag — ${missing.join(", ")} no longer available.`);
    setTimeout(() => { window.location.href = "cart.html"; }, 900);
    return;
  }
  window.location.href = "cart.html";
}

function buildOrderCard(order){
  const card = document.createElement("div");
  card.className = "order-card";

  const head = document.createElement("div");
  head.className = "order-card-head";

  const idBlock = document.createElement("div");
  const number = document.createElement("div");
  number.className = "order-number";
  number.textContent = order.order_number;
  const date = document.createElement("div");
  date.className = "order-date";
  date.textContent = formatOrderDate(order.created_at);
  idBlock.append(number, date);

  const badges = document.createElement("div");
  badges.className = "order-badges";

  const statusBadge = document.createElement("span");
  statusBadge.className = `order-status-badge status-${order.order_status}`;
  statusBadge.textContent = orderStatusLabel(order.order_status);

  const paymentBadge = document.createElement("span");
  paymentBadge.className = `order-status-badge payment-${order.payment_status}`;
  paymentBadge.textContent = paymentStatusLabel(order.payment_status);

  badges.append(statusBadge, paymentBadge);
  head.append(idBlock, badges);

  const itemsList = document.createElement("div");
  itemsList.className = "order-items";
  (order.items || []).forEach(item => {
    const row = document.createElement("div");
    row.className = "order-item-row";
    const name = document.createElement("span");
    name.textContent = `${item.name} × ${item.qty}`;
    const price = document.createElement("span");
    price.textContent = window.formatINR(item.price * item.qty);
    row.append(name, price);
    itemsList.appendChild(row);
  });

  const foot = document.createElement("div");
  foot.className = "order-card-foot";

  const total = document.createElement("span");
  total.className = "order-total";
  total.textContent = `Total: ${window.formatINR(order.total)}`;

  const reorderBtn = document.createElement("button");
  reorderBtn.type = "button";
  reorderBtn.className = "btn btn-outline order-reorder-btn";
  reorderBtn.textContent = "Reorder";
  reorderBtn.addEventListener("click", () => reorder(order));

  foot.append(total, reorderBtn);
  card.append(head, itemsList, foot);
  return card;
}

function paintOrders(orders){
  const list = document.querySelector("[data-orders-list]");
  const filterEmpty = document.querySelector("[data-orders-filter-empty]");
  list.innerHTML = "";

  if(orders.length === 0){
    filterEmpty?.classList.remove("hidden");
    return;
  }
  filterEmpty?.classList.add("hidden");
  orders.forEach(order => list.appendChild(buildOrderCard(order)));
}

function initOrdersFilter(){
  const row = document.querySelector("[data-orders-filter-row]");
  if(!row) return;

  Object.keys(ORDER_FILTERS).forEach((label, i) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-pill" + (i === 0 ? " active" : "");
    pill.textContent = label;
    pill.addEventListener("click", () => {
      row.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const statuses = ORDER_FILTERS[label];
      const filtered = statuses ? allOrders.filter(o => statuses.includes(o.order_status)) : allOrders;
      paintOrders(filtered);
    });
    row.appendChild(pill);
  });
}

async function loadOrders(){
  const gate = document.querySelector("[data-orders-authgate]");
  if(!gate) return;

  const client = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
  if(!client){
    // Supabase isn't configured yet — nothing to show, but don't strand
    // the visitor on "Checking your session…" forever.
    document.querySelector("[data-auth-checking]")?.classList.add("hidden");
    gate.classList.remove("hidden");
    document.querySelector("[data-orders-empty]")?.classList.remove("hidden");
    return;
  }

  const { data } = await client.auth.getSession();
  if(!data.session){
    window.location.href = "login.html?redirect=orders.html";
    return;
  }

  const result = await window.DivaSupabase.fetchMyOrders();

  document.querySelector("[data-auth-checking]")?.classList.add("hidden");
  gate.classList.remove("hidden");

  const empty = document.querySelector("[data-orders-empty]");

  if(!result.ok || result.orders.length === 0){
    empty?.classList.remove("hidden");
    return;
  }

  allOrders = result.orders;
  initOrdersFilter();
  paintOrders(allOrders);
}

document.addEventListener("DOMContentLoaded", loadOrders);
