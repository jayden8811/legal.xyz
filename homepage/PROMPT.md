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
- Center: the black logo mark, 38px tall, with the line "legal.xyz gives your legal conversations real privacy" below it, centered over two lines (24px, regular weight, line-height 1.3).
- Bottom: a centered row of uppercase links (11px, letter-spacing 0.06em, 28px apart): How?, Get access, Contact.
- "How?" fades the line out, types "by giving your chats privilege" in its place, then types out a lighter (300 weight, 15px, #555) explanation under it with a blinking caret; a second click goes back. "Get access" does nothing yet.
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

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

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
.home-line { grid-area: 1 / 1; align-self: center; opacity: 0; transition: opacity 0.45s ease; }
.home-line.is-on { opacity: 1; }
.home-links { padding-top: 0; }
.home-email { color: inherit; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; }
@media (prefers-reduced-motion: reduce) { .home-line { transition: none; } }

/* "How?" detail: typed out under the line without moving the line itself. */
.home-copy { position: relative; display: flex; flex-direction: column; align-items: center; }
.home-sub {
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  width: min(420px, calc(100vw - 48px)); margin: 18px 0 0;
  color: #555; font: 300 15px/1.6 "Inter", system-ui, sans-serif; letter-spacing: 0; text-align: center;
}
@media (max-width: 720px) { .home-sub { font-size: 14px; margin-top: 16px; } }

/* Phones: the links sit right under the line instead of at the bottom; the How? detail goes between them. */
@media (max-width: 720px) {
  .home.is-active { justify-content: center; }
  .home .home-center { flex: none; padding-bottom: 0; }
  .home-sub { position: static; transform: none; width: auto; max-width: 340px; }
  .home .home-links { padding-top: 32px; padding-bottom: max(40px, env(safe-area-inset-bottom, 0px)); }
}

  </style>
</head>
<body>

  <main id="app">
    <!-- Home -->
    <section class="screen landing home is-active" data-screen="hero">
      <div class="home-center">
        <img class="home-icon" src="assets/mark.png" alt="legal.xyz" />
        <div class="home-copy">
          <h1 class="home-title" aria-live="polite">
            <span class="home-line is-on" data-line="main">legal.xyz gives your legal conversations real privacy</span>
            <span class="home-line" data-line="how" aria-hidden="true"><span class="sr-only">by giving your chats privilege</span><span aria-hidden="true" data-typed-head></span></span>
          </h1>
          <p class="home-sub" data-how-sub hidden>
            <span class="sr-only">Your lawyer directs your workspace under a signed agreement, so your AI conversations are made for legal advice and can be protected as attorney-client privileged. They're also encrypted on your device, so only you and your lawyer can read them.</span>
            <span aria-hidden="true" data-typed></span>
          </p>
        </div>
      </div>

      <nav class="home-links" aria-label="legal.xyz">
        <button type="button" data-how aria-pressed="false">How?</button>
        <button type="button" data-get-access>Get access</button>
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
// Page wiring: "How?", "Get access" and the contact screen.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  // "How?" fades the line out, then types the short answer and the detail under it; again, back.
  const howBtn = $("[data-how]");
  const howSub = $("[data-how-sub]");
  const typedHead = $("[data-typed-head]");
  const typed = howSub.querySelector("[data-typed]");
  const headText = typedHead.previousElementSibling.textContent.trim();
  const subText = howSub.querySelector(".sr-only").textContent.trim();
  let typing = 0;
  const typeInto = (el, text, done) => {
    let i = 0;
    el.classList.add("is-typing");
    const step = () => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) typing = setTimeout(step, 22);
      else if (done) typing = setTimeout(() => { el.classList.remove("is-typing"); done(); }, 250);
    };
    step();
  };
  howBtn.addEventListener("click", () => {
    const showHow = howBtn.getAttribute("aria-pressed") !== "true";
    howBtn.setAttribute("aria-pressed", String(showHow));
    $$(".home-line").forEach((l) => {
      const on = (l.dataset.line === "how") === showHow;
      l.classList.toggle("is-on", on);
      l.setAttribute("aria-hidden", String(!on));
    });
    clearTimeout(typing);
    typedHead.textContent = typed.textContent = "";
    typedHead.classList.remove("is-typing");
    typed.classList.remove("is-typing");
    howSub.hidden = !showHow;
    if (!showHow) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typedHead.textContent = headText;
      typed.textContent = subText;
      return;
    }
    // after the old line fades out
    typing = setTimeout(() => typeInto(typedHead, headText, () => typeInto(typed, subText)), 450);
  });

  // "Get access": point this at your access request flow.
  $("[data-get-access]").addEventListener("click", () => {});

  // #contact shows the contact screen.
  const route = () => {
    const name = location.hash === "#contact" ? "contact" : "hero";
    $$(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
  };
  addEventListener("hashchange", route);
  route();

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
})();
  </script>
</body>
</html>
````
