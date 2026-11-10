Build me a website home page that is an exact, one-to-one copy of the page below. Nothing else: no backend, no sign-up flow, no other pages, no frameworks or build tools.

Rules:
1. Save the code below as `index.html` exactly as written, character for character. Do not reformat, rename, "clean up", or "improve" anything.
2. Next to it, create an `assets/` folder with the two images I've attached, using these exact names:
   - `assets/mark.png`: the logo mark, tightly cropped (white squares on transparent; the page inverts it to black)
   - `assets/icon.png`: the same mark with padding, used as the browser tab icon
3. The font is Inter, loaded from Google Fonts as linked in the code.
4. Reply with the complete `index.html` in a single code block, then confirm the folder layout.

What the page looks like, so you can check the copy:
- One full-height screen on an off-white background (#fafafa), all text black.
- Center: the black logo mark, 38px tall, with the line "legal.xyz gets your law firm more signed cases from the leads you’ve already paid for." below it, centered over two lines (24px, regular weight, line-height 1.3).
- Bottom: a centered row of uppercase links (11px, letter-spacing 0.06em, 28px apart): Apply, Contact.
- "Apply" (#apply) swaps the line for a form (name, law firm name, email, website) that posts JSON to `data-apply-endpoint` (/api/apply), and the nav item reads "Back"; after submitting, "Application received. We review every application and will respond by email shortly." replaces the form.
- "Contact" (#contact) shows the same layout with "Email us at contact@legal.xyz", a Copy email button and Back.
- On phones the links sit right under the line (and under the How? explanation once it shows) instead of at the bottom, and everything scales down.

Here is the code:

````html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>legal.xyz</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet" />
  <link rel="icon" href="assets/icon.png" />
  <style>
:root {
  --ink: #0b0b0d;
  --paper: #f4f4f5;
  --muted: rgba(244, 244, 245, 0.74);
  --faint: rgba(244, 244, 245, 0.5);
  --line: rgba(255, 255, 255, 0.16);
  --glass: rgba(14, 14, 17, 0.8);
  --accent: linear-gradient(90deg, #ff5a3c, #ff3cac 45%, #7b5cff);
  --danger: #ff8a7a;
  --radius: 16px;
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --ok: #7be3a5;
  --warn: #ffcf7a;
}

* { box-sizing: border-box; }

[hidden] { display: none !important; }

html, body { height: 100%; margin: 0; }

body {
  font-family: "Inter", system-ui, sans-serif;
  color: var(--paper);
  background: #c9cacd;
  -webkit-font-smoothing: antialiased;
}

/* ---------- Layout ---------- */

.screen { display: none; min-height: 100vh; min-height: 100dvh; }
.screen.is-active { display: flex; }

/* ---------- Landing hero ---------- */

.landing.is-active { display: block; }

/* ---------- Forms ---------- */

label { display: block; margin-bottom: 14px; font-size: 13px; color: var(--muted); }

input:not([type="checkbox"]),
textarea,
select {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--paper);
  font: inherit;
  font-size: 15px;
  outline: none;
  resize: vertical;
}

input::placeholder, textarea::placeholder { color: rgba(255, 255, 255, 0.32); }
input:focus, textarea:focus, select:focus { border-color: rgba(255, 255, 255, 0.5); }

/* ---------- Workspace ---------- */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

/* ==========================================================================
   Refinement: quieter surfaces, fewer outlines, clearer hierarchy
   ========================================================================== */

:root {
  --line: rgba(255, 255, 255, 0.09);
  --glass: rgba(16, 16, 19, 0.88);
  --muted: rgba(244, 244, 245, 0.7);
  --faint: rgba(244, 244, 245, 0.46);
  --surface: rgba(255, 255, 255, 0.045);
  --surface-2: rgba(255, 255, 255, 0.08);
  --radius: 14px;
}

/* ==========================================================================
   Product UI: flat and neutral. The artwork appears only on the home page.
   ========================================================================== */

:root {
  --app-bg: #0e0e10;
  --panel: #151518;
  --panel-2: #1b1b1f;
  --focus: rgba(255, 255, 255, 0.6);
  --alert: #e5484d;
}

/* One focus color and one control color everywhere */
:focus-visible { outline-color: var(--focus) !important; }

/* ==========================================================================
   Home: calmer hero, rotating AI names, 3D globe, showcase, centered layout
   ========================================================================== */

@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

/* Slightly stronger secondary text for readability */
:root { --faint: rgba(244, 244, 245, 0.54); }

/* ==========================================================================
   Home: a single, quiet screen. Light background, centered mark and line,
   uppercase links above and below.
   ========================================================================== */

.home.is-active {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: #fafafa;
  color: #000;
  font-family: "Inter", system-ui, sans-serif;
}

.home-nav,
.home-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 53px;
  padding-left: max(24px, env(safe-area-inset-left, 0px));
  padding-right: max(24px, env(safe-area-inset-right, 0px));
}
.home-links { padding-bottom: max(70px, env(safe-area-inset-bottom, 0px)); }

.home-nav a,
.home-nav button,
.home-links a,
.home-links button {
  padding: 0;
  border: 0;
  background: none;
  color: #000;
  font: 400 16px/1 "Inter", system-ui, sans-serif;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
}

.home-nav a:hover,
.home-nav button:hover,
.home-links a:hover,
.home-links button:hover { opacity: 0.6; }

.home-nav :focus-visible,
.home-links :focus-visible { outline: 2px solid #000 !important; outline-offset: 4px; }

.home-center {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.home-icon { height: 60px; filter: invert(1); }

.home-title {
  max-width: 540px;
  margin: 46px 0 0;
  font: 400 40px/1.3 "Inter", system-ui, sans-serif;
  letter-spacing: -0.01em;
  text-align: center;
  text-wrap: balance;
}

@media (max-width: 720px) {
  .home-nav, .home-links { gap: 10px 24px; }
  .home-links { padding-bottom: 32px; }
  .home-nav a, .home-nav button, .home-links a, .home-links button { font-size: 13px; }
  .home-icon { height: 48px; }
  .home-title { margin-top: 36px; font-size: 28px; }
}

/* Home at its true on-screen size (the reference was a 2x screenshot) */
.home-nav, .home-links { gap: 8px 28px; }
.home-links { padding-bottom: max(34px, env(safe-area-inset-bottom, 0px)); }
.home-nav a, .home-nav button, .home-links a, .home-links button { font-size: 11px; letter-spacing: 0.06em; }
.home-icon { height: 30px; }
.home-title { max-width: 290px; margin-top: 24px; font-size: 20px; line-height: 1.3; }
@media (max-width: 720px) {
  .home-nav, .home-links { gap: 8px 18px; }
  .home-links { padding-bottom: 26px; }
  .home-nav a, .home-nav button, .home-links a, .home-links button { font-size: 11px; }
  .home-icon { height: 28px; }
  .home-title { margin-top: 22px; font-size: 19px; }
}
/* Slightly larger mark and line */
.home-icon { height: 38px; }
.home-title { max-width: 340px; margin-top: 28px; font-size: 24px; }
@media (max-width: 720px) {
  .home-icon { height: 34px; }
  .home-title { max-width: 320px; margin-top: 24px; font-size: 22px; }
}

/* Home: the line and its "How?" answer share one spot and crossfade. */
.home-title { display: grid; }
.home-links { padding-top: 0; }
.home-email { color: inherit; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; }

/* Phones: the links sit right under the line instead of at the bottom; the How? detail goes between them. */
@media (max-width: 720px) {
  .home.is-active { justify-content: center; }
  .home .home-center { flex: none; padding-bottom: 0; }
  .home .home-links { padding-top: 32px; padding-bottom: max(40px, env(safe-area-inset-bottom, 0px)); }
}

/* Home: access application ("Get access"). */
.home-apply { display: flex; flex: 1; flex-direction: column; align-items: center; width: 100%; padding: 28px 24px 56px; box-sizing: border-box; }
.home-apply[hidden] { display: none; }
.home-apply-title { margin: 0; font: 400 24px/1.3 "Inter", system-ui, sans-serif; letter-spacing: -0.01em; text-align: center; }
.home-apply-lede { max-width: 400px; margin: 10px 0 0; color: #555; font: 300 15px/1.6 "Inter", system-ui, sans-serif; text-align: center; }
.apply-form { display: grid; gap: 18px; width: min(440px, 100%); margin-top: 32px; }
.apply-field { display: grid; gap: 6px; }
.apply-field label { margin: 0; color: #000; font: 400 13px/1.4 "Inter", system-ui, sans-serif; }
.apply-field input,
.apply-field select,
.apply-field textarea {
  width: 100%; box-sizing: border-box; margin: 0; padding: 10px 12px;
  border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; color: #000;
  font: 400 15px/1.4 "Inter", system-ui, sans-serif;
}
.apply-field :focus { outline: none; border-color: #000; box-shadow: 0 0 0 1px #000; }
.apply-field-error { min-height: 0; margin: 0; color: #b42318; font: 400 12px/1.4 "Inter", system-ui, sans-serif; }
.apply-field-error:empty { display: none; }
.apply-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.apply-error { margin: 0; color: #b42318; font: 400 13px/1.4 "Inter", system-ui, sans-serif; }
.apply-error:empty { display: none; }
.apply-submit { height: 46px; margin-top: 4px; border: 0; border-radius: 6px; background: #000; color: #fff; font: 500 15px/1 "Inter", system-ui, sans-serif; cursor: pointer; }
.apply-submit:hover { background: #262626; }
.apply-submit:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
.apply-submit:disabled { opacity: 0.6; cursor: default; }
.home-apply-done { max-width: 360px; margin: auto 0; font: 400 22px/1.35 "Inter", system-ui, sans-serif; letter-spacing: -0.01em; text-align: center; outline: none; }
.home-apply-done[hidden] { display: none; }
@media (max-width: 720px) {
  .home-apply-title { font-size: 22px; }
}
.apply-field ::placeholder { color: #9a9a9a; opacity: 1; }

  </style>
</head>
<body>

  <main id="app">
    <!-- Home -->
    <section class="screen landing home is-active" data-screen="hero">
      <div class="home-center">
        <img class="home-icon" src="assets/mark.png" alt="legal.xyz" />
        <h1 class="home-title">legal.xyz gets your law firm more signed cases from the leads you’ve already paid for.</h1>
      </div>

      <div class="home-apply" data-apply hidden>
        <h1 class="home-apply-title home-apply-intro">Apply</h1>
        <p class="home-apply-lede home-apply-intro">Tell us about your firm and we’ll be in touch.</p>

        <!-- Applications go to the Vercel function at /api/apply (see server/README.md). -->
        <form class="apply-form" data-apply-form data-apply-endpoint="/api/apply" novalidate>
          <div class="apply-field">
            <label for="ap-name">Name</label>
            <input id="ap-name" name="fullName" autocomplete="name" maxlength="200" required />
            <p class="apply-field-error" aria-live="polite"></p>
          </div>
          <div class="apply-field">
            <label for="ap-firm">Law firm name</label>
            <input id="ap-firm" name="firmName" autocomplete="organization" maxlength="200" required />
            <p class="apply-field-error" aria-live="polite"></p>
          </div>
          <div class="apply-field">
            <label for="ap-email">Email</label>
            <input id="ap-email" name="workEmail" type="email" autocomplete="email" maxlength="254" required />
            <p class="apply-field-error" aria-live="polite"></p>
          </div>
          <div class="apply-field">
            <label for="ap-site">Website</label>
            <input id="ap-site" name="site" type="url" inputmode="url" autocomplete="url" maxlength="300" placeholder="acmelaw.com" required />
            <p class="apply-field-error" aria-live="polite"></p>
          </div>
          <div class="apply-hp" aria-hidden="true">
            <label>Fax <input name="fax" tabindex="-1" autocomplete="off" /></label>
          </div>
          <p class="apply-error" data-apply-error role="alert"></p>
          <button class="apply-submit" type="submit">Apply</button>
        </form>

        <p class="home-apply-done" data-apply-done tabindex="-1" hidden>Application received. We review every application and will respond by email shortly.</p>
      </div>

      <nav class="home-links" aria-label="legal.xyz">
        <button type="button" data-get-access>Apply</button>
        <a href="#contact">Contact</a>
      </nav>
    </section>

    <!-- Contact -->
    <section class="screen home contact" data-screen="contact">
      <div class="home-center">
        <img class="home-icon" src="assets/mark.png" alt="legal.xyz" />
        <h1 class="home-title">Email us at <a class="home-email" href="mailto:contact@legal.xyz">contact@legal.xyz</a></h1>
      </div>

      <nav class="home-links" aria-label="Contact">
        <button type="button" data-copy-email>Copy email</button>
        <a href="#">Back</a>
      </nav>
    </section>
  </main>

  <script>
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

// Routing: #contact shows the contact screen, #apply the access application.
(() => {
  const route = () => {
    const hash = location.hash.slice(1);
    const name = hash === "contact" ? "contact" : "hero";
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    window.LegalHome.setApply(hash === "apply");
  };
  addEventListener("hashchange", route);
  route();
})();
  </script>
</body>
</html>
````
