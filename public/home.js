// Home page: the "Apply" form and the contact screen.
// Shared by the app and the standalone homepage/ copy; routing calls LegalHome.setApply.
window.LegalHome = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- Apply ----------

  const apply = $("[data-apply]");
  const form = $("[data-apply-form]");
  const done = $("[data-apply-done]");
  const applyBtn = $("[data-get-access]");
  const formError = $("[data-apply-error]");
  const blank = form.innerHTML;

  function setApply(open) {
    $('[data-screen="hero"]').classList.toggle("is-applying", open);
    apply.hidden = !open;
    applyBtn.textContent = open ? "Back" : "Apply";
    if (!open) return;
    if (!done.hidden) {
      // A new visit to the form starts fresh.
      done.hidden = true;
      form.hidden = false;
      form.innerHTML = blank;
      $$(".home-apply-intro", apply).forEach((el) => { el.hidden = false; });
    }
    window.scrollTo(0, 0);
    $("[name=fullName]", form).focus({ preventScroll: true });
  }

  applyBtn.addEventListener("click", () => {
    location.hash = location.hash === "#apply" ? "" : "apply";
  });

  function fieldError(field, msg) {
    const out = $(".apply-field-error", field.closest(".apply-field"));
    out.textContent = msg || "";
    if (msg) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
    return !msg;
  }

  // "acmelaw.com" and "https://www.acmelaw.com/" are both fine; anything without a dot isn't.
  const siteUrl = (v) => {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      return url.hostname.includes(".") ? url.href : null;
    } catch {
      return null;
    }
  };

  function validate() {
    let first = null;
    for (const f of $$(".apply-field input", form)) {
      const v = f.value.trim();
      let msg = "";
      if (!v) msg = "Required.";
      else if (f.name === "workEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Enter a valid email address.";
      else if (f.name === "site" && !siteUrl(v)) msg = "Enter your firm's website, like acmelaw.com.";
      if (!fieldError(f, msg) && !first) first = f;
    }
    if (first) first.focus();
    return !first;
  }

  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid")) fieldError(e.target, "");
  });

  // Posts to the endpoint on the form (data-apply-endpoint): /api/apply on Vercel.
  async function send(entry) {
    const res = await fetch(form.dataset.applyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";
    if (!validate()) return;
    const data = Object.fromEntries(new FormData(form));
    if (data.fax) return; // honeypot: bots fill hidden fields
    const entry = {
      name: data.fullName.trim(),
      firm: data.firmName.trim(),
      email: data.workEmail.trim().toLowerCase(),
      website: siteUrl(data.site.trim()),
      submittedAt: new Date().toISOString(),
    };
    const btn = $("[type=submit]", form);
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      await send(entry);
    } catch {
      btn.disabled = false;
      btn.textContent = "Apply";
      formError.textContent = "Something went wrong sending your application. Please try again, or email contact@legal.xyz.";
      return;
    }
    form.hidden = true;
    done.hidden = false;
    applyBtn.textContent = "Apply";
    $$(".home-apply-intro", apply).forEach((el) => { el.hidden = true; });
    // Leave #apply without a navigation, so "Apply" can open a fresh form.
    history.replaceState(null, "", location.pathname + location.search);
    done.focus();
  });

  // ---------- Contact ----------

  $("[data-copy-email]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText("contact@legal.xyz");
      btn.textContent = "Copied";
    } catch {
      getSelection().selectAllChildren($(".home-email"));
      btn.textContent = "Selected";
    }
    setTimeout(() => { btn.textContent = "Copy email"; }, 1600);
  });

  return { setApply };
})();
