/* ============================================================
   DIVA JEWELS — Admin "set new password" page logic
   Pulled out of admin/reset-password.html into its own file for
   the same reason as admin-login-page.js: the CSP has no
   'unsafe-inline' in script-src, so inline <script> blocks never
   run — moving real logic to an external file is required.
   ============================================================ */

function setStatus(msg, ok){
  const el = document.querySelector("[data-status]");
  el.textContent = msg;
  el.className = "form-status show " + (ok ? "ok" : "err");
}

document.querySelector("#reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const password = form.password.value;
  const confirm = form.confirm.value;

  if(password !== confirm){
    setStatus("Passwords don't match.", false);
    return;
  }
  if(password.length < 6){
    setStatus("Password must be at least 6 characters.", false);
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Updating…";

  const result = await window.DivaAdmin.adminUpdatePassword(password);

  btn.disabled = false;
  btn.textContent = "Update Password";

  if(result.ok){
    setStatus("Password updated. Redirecting to sign in…", true);
    await window.DivaAdmin.adminSignOut();
    setTimeout(() => { window.location.href = "login.html"; }, 1800);
  }else{
    setStatus(result.error || "This reset link may have expired — request a new one from the sign-in page.", false);
  }
});
