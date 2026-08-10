/* ============================================================
   DIVA JEWELS — Cart engine
   Stores cart contents in localStorage under a namespaced key.
   Only ever stores product id / qty — price & name are re-read
   from PRODUCTS at render time so a tampered localStorage value
   can't be used to under-charge at checkout.
   ============================================================ */

const CART_KEY = "diva_jewels_cart_v1";
const MAX_QTY_PER_ITEM = 10;

const Cart = {
  /** Read cart from storage safely. Never trust raw JSON blindly. */
  read(){
    try{
      const raw = localStorage.getItem(CART_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed
        .filter(row => row && typeof row.id === "string" && Number.isFinite(row.qty))
        .map(row => ({ id: row.id, qty: Math.min(Math.max(1, Math.floor(row.qty)), MAX_QTY_PER_ITEM) }));
    }catch(err){
      console.warn("Cart: could not read local storage, resetting cart.", err);
      return [];
    }
  },

  write(items){
    try{
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    }catch(err){
      console.warn("Cart: could not persist cart (storage may be full or blocked).", err);
    }
    Cart.updateBadge();
    document.dispatchEvent(new CustomEvent("cart:updated"));
  },

  add(productId, qty = 1){
    const product = window.PRODUCTS.find(p => p.id === productId);
    if(!product) return;
    const items = Cart.read();
    const existing = items.find(i => i.id === productId);
    if(existing){
      existing.qty = Math.min(existing.qty + qty, MAX_QTY_PER_ITEM);
    }else{
      items.push({ id: productId, qty: Math.min(qty, MAX_QTY_PER_ITEM) });
    }
    Cart.write(items);
  },

  setQty(productId, qty){
    let items = Cart.read();
    if(qty <= 0){
      items = items.filter(i => i.id !== productId);
    }else{
      const existing = items.find(i => i.id === productId);
      if(existing) existing.qty = Math.min(qty, MAX_QTY_PER_ITEM);
    }
    Cart.write(items);
  },

  remove(productId){
    const items = Cart.read().filter(i => i.id !== productId);
    Cart.write(items);
  },

  clear(){
    Cart.write([]);
  },

  /** Cart items joined with live product data (source of truth for price). */
  detailed(){
    return Cart.read()
      .map(row => {
        const product = window.PRODUCTS.find(p => p.id === row.id);
        if(!product) return null;
        return { ...product, qty: row.qty, lineTotal: product.price * row.qty };
      })
      .filter(Boolean);
  },

  count(){
    return Cart.read().reduce((sum, i) => sum + i.qty, 0);
  },

  subtotal(){
    return Cart.detailed().reduce((sum, i) => sum + i.lineTotal, 0);
  },

  updateBadge(){
    document.querySelectorAll("[data-cart-count]").forEach(el => {
      el.textContent = String(Cart.count());
    });
  }
};

document.addEventListener("DOMContentLoaded", Cart.updateBadge);
window.Cart = Cart;
