/* ============================================================
   DIVA JEWELS — Admin login page logic
   Pulled out of admin/login.html into its own file because the
   site's CSP has no 'unsafe-inline' in script-src — inline <script>
   blocks are blocked by the browser outright, silently, with no
   error shown to the user beyond the console. Anything with real
   logic must live in an external .js file like this one.
   ============================================================ */

function setStatus(msg, ok){
  const el = document.querySelector("[data-status]");
  el.textContent = msg;
  el.className = "form-status show " + (ok ? "ok" : "err");
}
function clearStatus(){
  const el = document.querySelector("[data-status]");
  el.className = "form-status";
  el.textContent = "";
}

// If already signed in as an admin, skip straight to the dashboard.
(async () => {
  const { isAdmin } = await window.DivaAdmin.adminCheckSession();
  if(isAdmin) window.location.href = "dashboard.html";
})();

document.querySelector("#admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Signing in…";

  const result = await window.DivaAdmin.adminSignIn({ email, password });
  if(!result.ok){
    btn.disabled = false;
    btn.textContent = "Sign In";
    setStatus(result.error || "Could not sign in.", false);
    return;
  }

  const check = await window.DivaAdmin.adminCheckSession();
  if(!check.isAdmin){
    await window.DivaAdmin.adminSignOut();
    btn.disabled = false;
    btn.textContent = "Sign In";
    setStatus("This account doesn't have admin access.", false);
    return;
  }

  window.location.href = "dashboard.html";
});

document.querySelector("[data-forgot-link]").addEventListener("click", (e) => {
  e.preventDefault();
  clearStatus();
  document.querySelector("#admin-login-form").classList.add("hidden");
  document.querySelector("#admin-forgot-form").classList.remove("hidden");
});
document.querySelector("[data-cancel-forgot]").addEventListener("click", () => {
  clearStatus();
  document.querySelector("#admin-forgot-form").classList.add("hidden");
  document.querySelector("#admin-login-form").classList.remove("hidden");
});
document.querySelector("#admin-forgot-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();
  const form = e.target;
  const email = form.email.value.trim();
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Sending…";

  const result = await window.DivaAdmin.adminSendPasswordReset(email);

  btn.disabled = false;
  btn.textContent = "Send Reset Link";
  if(result.ok){
    setStatus("If that email has admin access, a reset link is on its way.", true);
    form.reset();
  }else{
    setStatus(result.error || "Could not send the reset link.", false);
  }
});
