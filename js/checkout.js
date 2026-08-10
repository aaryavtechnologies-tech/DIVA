/* ============================================================
   DIVA JEWELS — Cart & checkout flow (cart.html only)
   ============================================================ */

const SHIPPING_FLAT_FEE = 0; // set a flat fee here if you charge for shipping
const FREE_SHIPPING_THRESHOLD = 1999;

/* ---------- Render cart list ---------- */
function renderCart(){
  const listEl = document.querySelector("[data-cart-list]");
  const emptyEl = document.querySelector("[data-cart-empty]");
  const layoutEl = document.querySelector("[data-cart-layout]");
  if(!listEl) return;

  const items = Cart.detailed();
  listEl.innerHTML = "";

  if(items.length === 0){
    emptyEl?.classList.remove("hidden");
    layoutEl?.classList.add("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");
  layoutEl?.classList.remove("hidden");

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;

    const mid = document.createElement("div");
    const cat = document.createElement("div");
    cat.className = "cat";
    cat.textContent = item.category;
    const name = document.createElement("h4");
    name.textContent = item.name;

    const qtyControl = document.createElement("div");
    qtyControl.className = "qty-control";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Decrease quantity of ${item.name}`);
    minus.addEventListener("click", () => { Cart.setQty(item.id, item.qty - 1); });
    const qtyLabel = document.createElement("span");
    qtyLabel.textContent = String(item.qty);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Increase quantity of ${item.name}`);
    plus.addEventListener("click", () => { Cart.setQty(item.id, item.qty + 1); });
    qtyControl.append(minus, qtyLabel, plus);

    mid.append(cat, name, qtyControl);

    const right = document.createElement("div");
    right.className = "cart-item-right";
    const price = document.createElement("div");
    price.className = "cart-item-price";
    price.textContent = formatINR(item.lineTotal);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-link";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => { Cart.remove(item.id); showToast(`${item.name} removed`); });
    right.append(price, remove);

    row.append(img, mid, right);
    listEl.appendChild(row);
  });

  updateSummary();
}

function updateSummary(){
  const subtotal = Cart.subtotal();
  const shipping = Cart.count() === 0 ? 0 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_FEE);
  const total = subtotal + shipping;

  setText("[data-subtotal]", formatINR(subtotal));
  setText("[data-shipping]", shipping === 0 ? "Free" : formatINR(shipping));
  setText("[data-total]", formatINR(total));
  setText("[data-pay-amount]", formatINR(total));

  return { subtotal, shipping, total };
}

function setText(selector, text){
  document.querySelectorAll(selector).forEach(el => { el.textContent = text; });
}

/* ---------- Step switching ---------- */
function goToStep(step){
  document.querySelectorAll("[data-step]").forEach(el => {
    el.classList.toggle("hidden", el.dataset.step !== step);
  });
  document.querySelectorAll(".step").forEach(el => {
    el.classList.remove("active", "done");
    if(el.dataset.stepLabel === step) el.classList.add("active");
    if((step === "address" && el.dataset.stepLabel === "cart") ||
       (step === "pay" && ["cart","address"].includes(el.dataset.stepLabel))){
      el.classList.add("done");
    }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Address form ---------- */
function initAddressForm(){
  const form = document.querySelector("#address-form");
  if(!form) return;

  document.querySelector("[data-to-address]")?.addEventListener("click", () => {
    if(Cart.count() === 0){
      showToast("Your bag is empty — add something beautiful first.");
      return;
    }
    goToStep("address");
  });
  document.querySelector("[data-back-to-cart]")?.addEventListener("click", () => goToStep("cart"));
  document.querySelector("[data-back-to-address]")?.addEventListener("click", () => goToStep("address"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if(!validateAddressForm(form)) return;
    renderReview(form);
    goToStep("pay");
  });
}

function validateAddressForm(form){
  const rules = [
    [form.name, form.name.value.trim().length >= 2],
    [form.phone, /^[0-9]{10}$/.test(form.phone.value.trim())],
    [form.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())],
    [form.pincode, /^[0-9]{6}$/.test(form.pincode.value.trim())],
    [form.address1, form.address1.value.trim().length >= 4],
    [form.city, form.city.value.trim().length >= 2],
    [form.state, form.state.value.trim().length >= 2],
    [form.country, form.country.value.trim().length >= 2]
  ];
  let allValid = true;
  rules.forEach(([input, ok]) => { allValid = validateField(input, ok) && allValid; });
  if(!allValid) showToast("Please check the highlighted fields.");
  return allValid;
}

function getAddressPayload(form){
  return {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    pincode: form.pincode.value.trim(),
    address1: form.address1.value.trim(),
    address2: form.address2.value.trim(),
    city: form.city.value.trim(),
    state: form.state.value.trim(),
    country: form.country.value.trim()
  };
}

function renderReview(form){
  const c = getAddressPayload(form);
  const el = document.querySelector("[data-address-review]");
  if(!el) return;
  el.innerHTML = "";
  const lines = [
    c.name,
    c.address2 ? `${c.address1}, ${c.address2}` : c.address1,
    `${c.city}, ${c.state} ${c.pincode}`,
    c.country,
    `${c.phone} · ${c.email}`
  ];
  lines.forEach(line => {
    const p = document.createElement("p");
    p.textContent = line;
    p.classList.add("u-note-line");
    el.appendChild(p);
  });
}

/* ---------- Dummy payment modal ---------- */
/** Shows the "Processing payment…" modal for a beat, then flips to a
 *  success state, then resolves. Purely visual — the actual order
 *  status update happens in initPayment() after this resolves. */
function runDummyPaymentModal(){
  const modal = document.querySelector("[data-payment-modal]");
  const processing = document.querySelector("[data-payment-processing]");
  const success = document.querySelector("[data-payment-success]");
  if(!modal) return Promise.resolve();

  processing?.classList.remove("hidden");
  success?.classList.add("hidden");
  modal.classList.add("open");

  return new Promise(resolve => {
    setTimeout(() => {
      processing?.classList.add("hidden");
      success?.classList.remove("hidden");
      setTimeout(() => {
        modal.classList.remove("open");
        resolve();
      }, 1000);
    }, 1600);
  });
}

/* ---------- Payment (Razorpay placeholder) ---------- */
function initPayment(){
  const payBtn = document.querySelector("[data-pay-btn]");
  if(!payBtn) return;

  payBtn.addEventListener("click", async () => {
    const form = document.querySelector("#address-form");
    if(!validateAddressForm(form)){
      goToStep("address");
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = "Placing your order…";

    const { subtotal, shipping, total } = updateSummary();
    const orderPayload = {
      customer: getAddressPayload(form),
      items: Cart.detailed().map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      subtotal,
      shipping,
      total
    };

    const result = await window.DivaSupabase.createOrder(orderPayload);

    payBtn.disabled = false;
    payBtn.textContent = `Pay ${formatINR(total)}`;

    if(!result.ok){
      showToast("We couldn't save your order — please try again.");
      return;
    }

    // --- Razorpay handoff -------------------------------------------------
    // Razorpay order creation requires your KEY_SECRET, which must never
    // live in frontend code. Create it server-side (a Supabase Edge Function
    // is a good fit) and return { razorpayOrderId, keyId } to the browser,
    // then open checkout like this:
    //
    // const rzp = new Razorpay({
    //   key: keyId,
    //   amount: total * 100,
    //   currency: "INR",
    //   order_id: razorpayOrderId,
    //   name: "Diva Jewels",
    //   prefill: { name: orderPayload.customer.name, email: orderPayload.customer.email, contact: orderPayload.customer.phone },
    //   handler: function(response){ /* verify signature server-side, then mark order paid */ },
    // });
    // rzp.open();

    if(typeof Razorpay === "undefined"){
      // No live Razorpay key yet — run the simulated payment modal so the
      // demo still feels like a real checkout. This is UI-only: it does
      // NOT flip orders.payment_status in the database. That's deliberate
      // — RLS only allows admins to update orders (see schema.sql), so a
      // customer's browser could never do this even if we tried, and once
      // real Razorpay is wired up payment_status must only ever be set by
      // the signature-verified webhook, never the browser. The order sits
      // as "pending" until an admin (or the future webhook) confirms it.
      await runDummyPaymentModal();

      goToStep("confirmed");
      renderConfirmation(result.orderNumber, total, { paid: true });
      Cart.clear();
      return;
    }

    showToast(`Order ${result.orderNumber} saved — connect your Razorpay key in js/checkout.js to accept payment.`);
    goToStep("confirmed");
    renderConfirmation(result.orderNumber, total, { paid: false });
    Cart.clear();
  });
}

function renderConfirmation(orderNumber, total, { paid } = {}){
  setText("[data-confirm-order-number]", orderNumber);
  setText("[data-confirm-total]", formatINR(total));
  setText("[data-confirm-payment-note]", paid
    ? "Payment simulated (demo) — this order is saved and waiting on an admin to confirm it, same as a real order would."
    : "You'll receive a confirmation once payment is set up and confirmed.");
  document.querySelector("[data-admin-note]")?.classList.toggle("hidden", !paid);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Prices/names are re-read from window.PRODUCTS at render time (see
  // js/cart.js), so wait for the live catalogue before painting totals.
  if(window.PRODUCTS_READY) await window.PRODUCTS_READY;
  renderCart();
  initAddressForm();
  initPayment();
  document.addEventListener("cart:updated", renderCart);
});
