/* ============================================================
   DIVA JEWELS — Auth pages + cart auth-gate
   Included on login.html, signup.html and cart.html.
   Every function checks for its own DOM hooks first and returns
   early if they're not on the page, so one file can serve all three.
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
 *  to the cart. Signed in -> reveal the cart and show who's signed in. */
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

  renderAccountBar(data.session.user);
  revealCartContent();
}

function revealCartContent(){
  document.querySelector("[data-cart-authgate]")?.classList.remove("hidden");
  document.querySelector("[data-auth-checking]")?.classList.add("hidden");
}

function renderAccountBar(user){
  const bar = document.querySelector("[data-account-bar]");
  if(!bar || !user) return;
  bar.innerHTML = "";

  const who = document.createElement("span");
  who.textContent = `Signed in as ${user.email}`;

  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.className = "remove-link";
  signOutBtn.textContent = "Sign out";
  signOutBtn.addEventListener("click", async () => {
    await window.DivaSupabase.signOut();
    window.location.href = "login.html";
  });

  bar.append(who, signOutBtn);
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  initSignupForm();
  guardCartAuth();
});
