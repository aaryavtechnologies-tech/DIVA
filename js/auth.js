/* ============================================================
   DIVA JEWELS — Auth pages, cart auth-gate, header account dropdown
   Included on every storefront page (index/products/about/contact/
   cart/login/signup/orders). Every function checks for its own DOM
   hooks first and returns early if they're not on the page, so one
   file can serve all of them.
   ============================================================ */

/** Reads ?redirect= from the URL. Only ever allows a same-site
 *  "somepage.html" value — never an absolute/external URL — so this
 *  can't be abused as an open redirect. */
function getRedirectTarget(){
  const params = new URLSearchParams(window.location.search);
  const target = params.get("redirect");
  if(target && /^[a-zA-Z0-9_-]+\.html$/.test(target)) return target;
  return "cart.html";
}
window.getRedirectTarget = getRedirectTarget;

/* ---------- Google OAuth button (login.html + signup.html) ---------- */
function initGoogleButton(){
  const btn = document.querySelector("[data-google-btn]");
  if(!btn) return;

  btn.addEventListener("click", async () => {
    const status = document.querySelector(".form-status");
    status?.classList.remove("show", "ok", "err");
    btn.disabled = true;

    const result = await window.DivaSupabase.signInWithGoogle(getRedirectTarget());

    if(!result.ok){
      btn.disabled = false;
      if(status){
        status.textContent = result.error || "Could not start Google sign-in — try again.";
        status.classList.add("show", "err");
      }
      return;
    }
    // On success the browser navigates away to Google immediately —
    // nothing further to do here.
  });
}

/* ---------- Login page ---------- */
function initLoginForm(){
  const form = document.querySelector("#login-form");
  if(!form) return;

  const signupLink = document.querySelector("[data-signup-link]");
  if(signupLink) signupLink.href = `signup.html?redirect=${encodeURIComponent(getRedirectTarget())}`;

  const status = form.querySelector(".form-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;

    let valid = true;
    valid = validateField(form.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && valid;
    valid = validateField(form.password, password.length >= 6) && valid;
    status?.classList.remove("show", "ok", "err");
    if(!valid) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Signing in…";

    const result = await window.DivaSupabase.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.textContent = "Sign In";

    if(!result.ok){
      if(status){
        status.textContent = result.error || "Could not sign in — check your details and try again.";
        status.classList.add("show", "err");
      }
      return;
    }
    window.location.href = getRedirectTarget();
  });
}

/* ---------- Signup page ---------- */
function initSignupForm(){
  const form = document.querySelector("#signup-form");
  if(!form) return;

  const loginLink = document.querySelector("[data-login-link]");
  if(loginLink) loginLink.href = `login.html?redirect=${encodeURIComponent(getRedirectTarget())}`;

  const status = form.querySelector(".form-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.confirm.value;

    let valid = true;
    valid = validateField(form.name, name.length >= 2) && valid;
    valid = validateField(form.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && valid;
    valid = validateField(form.password, password.length >= 6) && valid;
    valid = validateField(form.confirm, confirm.length > 0 && confirm === password) && valid;
    status?.classList.remove("show", "ok", "err");
    if(!valid) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Creating account…";

    const result = await window.DivaSupabase.signUpWithPassword({ name, email, password });

    btn.disabled = false;
    btn.textContent = "Create Account";

    if(!result.ok){
      if(status){
        status.textContent = result.error || "Could not create your account — please try again.";
        status.classList.add("show", "err");
      }
      return;
    }

    if(result.needsEmailConfirm){
      if(status){
        status.textContent = "Account created — check your email to confirm it, then sign in.";
        status.classList.add("show", "ok");
      }
      form.reset();
      return;
    }

    window.location.href = getRedirectTarget();
  });
}

/* ---------- Cart auth-gate ---------- */
/** Runs only on cart.html (guarded by the data-cart-authgate hook).
 *  Not signed in -> straight to login.html, remembering to come back
 *  to the cart. Signed in -> reveal the cart. Who's signed in is shown
 *  by the shared header account dropdown (initAccountMenu below), not
 *  duplicated here. */
async function guardCartAuth(){
  const gate = document.querySelector("[data-cart-authgate]");
  if(!gate) return;

  const client = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
  if(!client){
    // Supabase isn't configured yet — don't lock the demo flow out of the cart.
    revealCartContent();
    return;
  }

  const { data } = await client.auth.getSession();
  if(!data.session){
    window.location.href = "login.html?redirect=cart.html";
    return;
  }

  revealCartContent();
}

function revealCartContent(){
  document.querySelector("[data-cart-authgate]")?.classList.remove("hidden");
  document.querySelector("[data-auth-checking]")?.classList.add("hidden");
}

/* ---------- Header account dropdown (every storefront page) ---------- */
/** The [data-account-menu] markup lives in the header of every storefront
 *  page. This is the one place that populates it — nothing else should
 *  duplicate this logic (e.g. cart.html's old separate account bar). */
function currentPageFile(){
  const file = window.location.pathname.split("/").pop();
  return file && /^[a-zA-Z0-9_-]+\.html$/.test(file) ? file : "index.html";
}

function renderAccountDropdown(dropdown, trigger, user){
  dropdown.innerHTML = "";
  trigger.classList.toggle("has-session", !!user);

  if(!user){
    const redirect = encodeURIComponent(currentPageFile());

    const signIn = document.createElement("a");
    signIn.href = `login.html?redirect=${redirect}`;
    signIn.textContent = "Sign In";

    const signUp = document.createElement("a");
    signUp.href = `signup.html?redirect=${redirect}`;
    signUp.textContent = "Create Account";

    dropdown.append(signIn, signUp);
    return;
  }

  const who = document.createElement("div");
  who.className = "who";
  who.textContent = `Signed in as ${user.email}`;

  const orders = document.createElement("a");
  orders.href = "orders.html";
  orders.textContent = "My Orders";

  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.className = "signout";
  signOutBtn.textContent = "Sign Out";
  signOutBtn.addEventListener("click", async () => {
    await window.DivaSupabase.signOut();
    window.location.href = "login.html";
  });

  dropdown.append(who, orders, signOutBtn);
}

async function initAccountMenu(){
  const menu = document.querySelector("[data-account-menu]");
  const trigger = menu?.querySelector("[data-account-trigger]");
  const dropdown = menu?.querySelector("[data-account-dropdown]");
  if(!menu || !trigger || !dropdown) return;

  const client = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
  const initialUser = client ? (await client.auth.getSession()).data.session?.user || null : null;
  renderAccountDropdown(dropdown, trigger, initialUser);

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (e) => {
    if(!menu.contains(e.target)){
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  // Keep the dropdown in sync if the session changes without a full page
  // reload (e.g. arriving back from a Google OAuth redirect).
  if(client){
    client.auth.onAuthStateChange((_event, session) => {
      renderAccountDropdown(dropdown, trigger, session?.user || null);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  initSignupForm();
  initGoogleButton();
  guardCartAuth();
  initAccountMenu();
});
