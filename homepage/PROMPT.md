Build me a website home page that is an exact, one-to-one copy of the page below. Nothing else: no backend, no sign-up flow, no other pages, no frameworks or build tools.

Rules:
1. Save the code below as `index.html` exactly as written, character for character. Do not reformat, shorten, rename, "clean up", or "improve" anything, and do not drop any CSS or JavaScript, including the vendor-prefixed properties.
2. Next to it, create an `assets/` folder holding the four images I've attached, using these exact file names:
   - `assets/bg.png`: the blurred black-and-white artwork with colored light streaks (inside the hero panel)
   - `assets/icon.png`: the small square dotted logo icon
   - `assets/wordmark.png`: the "legal.xyz" serif wordmark (white on transparent)
   - `assets/logo.png`: the icon and wordmark together (used in the footer)
3. Fonts load from Google Fonts (Inter and Newsreader), as linked in the code.
4. Open `index.html` in a browser to check it. Every animation is plain HTML, CSS and JavaScript, with no libraries.
5. Reply with the complete `index.html` in a single code block, then confirm the folder layout.

What the page contains, so you can verify the copy is complete:
- Top nav: the logo (the icon appears, then the wordmark slides out beside it), links for Privilege, Pricing and Security, and a "Get started" button.
- A rounded hero panel ending about three-quarters of the way down the screen. Inside it: dimmed artwork, a slowly rotating 3D dot globe whose dots twinkle like stars and lean toward the mouse, the "Attorney-client privilege, built in" pill, and the headline "Chatting with [ChatGPT / Claude / Gemini] about your legal matters puts them at risk of being subpoenaed." The AI name crossfades with a blur, and the line eases its width so nothing jumps. Below are the subheader "legal.xyz gives your conversations real privacy." and two buttons.
- The hero scales down slightly and fades as you scroll. The mouse wheel scrolls with a smooth, slightly delayed ease.
- "What you type, and what we store": two 3D-tilted floating cards. A legal question types itself on the left while encrypted text builds on the right. The cards tilt toward the mouse and straighten as they reach the middle of the screen.
- "Why not just use a chatbot?": a comparison table.
- "How privilege works": three cards that tilt toward the mouse with a light sheen, each with a layered, floating 3D icon, plus a note that a court decides privilege.
- "Pricing": one $497/month card that tilts with a sheen, with a "Talk to sales" link that opens a small dialog with a copyable email.
- "Questions": five FAQ items that fold in from a 3D angle; answers unfold when opened.
- A centered footer.
- Every section rises into view with depth as you scroll, staggered for list items. With "reduce motion" switched on, everything is static.

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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet" />
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

/* ---------- Background ---------- */

.bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: #0d0d10;
}

.bg-layer {
  position: absolute;
  inset: 0;
  background: url("assets/bg.png") center / cover no-repeat;
}

/* On the landing page the artwork fades to near-black on the left, behind the headline.
   Other screens get an even wash so cards stay legible. */
.scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(8, 8, 10, 0.94) 0%, rgba(8, 8, 10, 0.82) 40%, rgba(8, 8, 10, 0.35) 78%, rgba(8, 8, 10, 0.2) 100%);
}

/* ---------- Layout ---------- */

.screen { display: none; min-height: 100vh; min-height: 100dvh; }
.screen.is-active { display: flex; }

/* ---------- Landing hero ---------- */

.landing.is-active { display: block; }

.hero {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.site-nav,
.hero-body {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding-left: max(24px, env(safe-area-inset-left, 0px));
  padding-right: max(24px, env(safe-area-inset-right, 0px));
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-block: max(22px, env(safe-area-inset-top, 0px)) 22px;
}

.nav-links { display: flex; gap: 2px; margin-left: auto; }

.nav-links button,
.nav-links a {
  padding: 8px 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
}

.nav-links button:hover,
.nav-links a:hover { color: var(--paper); background: rgba(255, 255, 255, 0.06); }
.nav-links :focus-visible { outline: 2px solid #ff3cac; outline-offset: 2px; }

.site-nav > .btn { padding: 9px 16px; }

/* Logo: the icon appears, then the wordmark slides out beside it */
.brand { --h: 26px; display: flex; align-items: center; margin: 0; }
.brand-icon { height: var(--h); }
.brand-word { display: grid; grid-template-columns: minmax(0, 1fr); overflow: hidden; }
.brand-word img { height: var(--h); min-width: 0; margin-left: calc(var(--h) * 0.3); }

.brand.intro .brand-icon { animation: fade-in 0.5s ease both; }
.brand.intro .brand-word { animation: reveal 0.7s cubic-bezier(0.65, 0, 0.25, 1) 0.4s both; }
.brand.intro .brand-word img { animation: slide-in 0.7s cubic-bezier(0.65, 0, 0.25, 1) 0.4s both; }

@keyframes fade-in { from { opacity: 0; } }
@keyframes reveal { from { grid-template-columns: minmax(0, 0fr); } to { grid-template-columns: minmax(0, 1fr); } }
@keyframes slide-in { from { opacity: 0; transform: translateX(-12px); } }

.hero-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 22px;
  padding-block: 40px 72px;
}

.hero-title {
  max-width: 13em;
  margin: 0;
  font-family: var(--serif);
  font-size: clamp(40px, 5.6vw, 68px);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.015em;
  text-wrap: balance;
}

.hero-sub { max-width: 34em; margin: 0; font-size: 18px; line-height: 1.6; color: var(--muted); }

.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
.hero-actions .btn { padding: 13px 22px; font-size: 15px; }

.hero.intro .hero-body > * { animation: rise 0.6s ease both; }
.hero.intro .hero-body > :nth-child(2) { animation-delay: 0.06s; }
.hero.intro .hero-body > :nth-child(3) { animation-delay: 0.12s; }
.hero.intro .hero-body > :nth-child(4) { animation-delay: 0.18s; }

@keyframes rise { from { opacity: 0; transform: translateY(8px); } }

@media (max-width: 820px) {
  .nav-links { display: none; }
  .site-nav > .btn { margin-left: auto; }
  .scrim { background: linear-gradient(180deg, rgba(8, 8, 10, 0.6), rgba(8, 8, 10, 0.92) 55%); }
  .hero-sub { font-size: 16px; }
}

/* ---------- Card ---------- */

.card {
  width: min(100%, 520px);
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--glass);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
  animation: card-in 0.5s ease both;
}

@keyframes card-in { from { opacity: 0; transform: translateY(12px) scale(0.99); } }

.logo-sm { height: 22px; }

h2 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }

.sub { margin: 0 0 22px; color: var(--muted); font-size: 14px; line-height: 1.55; }

/* ---------- Forms ---------- */

.actions, .row { display: flex; gap: 10px; flex-wrap: wrap; }
.actions { justify-content: flex-end; margin-top: 22px; }

/* ---------- Buttons ---------- */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 20px;
  border: 1px solid transparent;
  border-radius: 999px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
}

.btn-primary { background: var(--paper); color: var(--ink); }
.btn-primary:hover { opacity: 0.88; }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-ghost { background: transparent; color: var(--paper); border-color: var(--line); }

.btn:focus-visible, summary:focus-visible { outline: 2px solid #ff3cac; outline-offset: 2px; }

/* ---------- Workspace ---------- */

.ws-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
}

.ws-overlay[hidden] { display: none; }

@media (max-width: 520px) {
  .card { padding: 22px 18px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

/* ---------- Landing body ---------- */

.landing-body {
  background: rgba(10, 10, 12, 0.9);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.band { border-top: 1px solid var(--line); }

.band-inner {
  max-width: 1040px;
  margin: 0 auto;
  padding-block: 88px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}

.band-inner.narrow { max-width: 720px; }

.band-title {
  margin: 0 0 40px;
  font-family: var(--serif);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.how { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; margin: 0; padding: 0; list-style: none; counter-reset: how; }
.how li { counter-increment: how; }
.how li::before { content: counter(how); display: block; margin-bottom: 14px; font-family: var(--serif); font-size: 40px; line-height: 1; color: var(--faint); }
.how h3, .plan h3 { margin: 0 0 8px; font-size: 17px; font-weight: 600; }
.how p { margin: 0; font-size: 15px; line-height: 1.6; color: var(--muted); }
.price { margin: 0 0 16px; font-size: 14px; color: var(--muted); }
.price span { font-family: var(--serif); font-size: 36px; color: var(--paper); }
.fine { margin: 16px 0 0; font-size: 12px; color: var(--faint); }

.faq { border-bottom: 1px solid var(--line); }
.faq summary { padding: 18px 0; font-size: 16px; font-weight: 500; cursor: pointer; }
.faq p { margin: 0 0 18px; font-size: 15px; line-height: 1.65; color: var(--muted); max-width: 65ch; }

.site-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  padding-block: 32px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  border-top: 1px solid var(--line);
  font-size: 13px;
  color: var(--faint);
}
.site-foot nav { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.site-foot a { color: var(--muted); text-decoration: none; }
.site-foot a:hover { color: var(--paper); }
.site-foot p { margin: 0 0 0 auto; }

/* ---------- Shared bits ---------- */

.btn-sm { padding: 7px 12px; font-size: 13px; }

/* ---------- Policy pages ---------- */

@media (max-width: 820px) {
  .how, .plans, .split, .cp-grid { grid-template-columns: minmax(0, 1fr); }
  .band-inner { padding-block: 64px; }
  .site-foot p { margin-left: 0; }
}

/* ---------- Workspace: header bits ---------- */

.link-btn { padding: 0; border: 0; background: none; color: var(--paper); font: inherit; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(255, 255, 255, 0.35); cursor: pointer; }
.link-btn:focus-visible { outline: 2px solid #ff3cac; outline-offset: 2px; }

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

/* Buttons */
.btn-ghost { background: var(--surface-2); border-color: transparent; }
.btn-text { padding-inline: 10px; border: 0; background: none; color: var(--muted); }
.btn-text:hover { color: var(--paper); }

/* Surfaces */
.card { box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); }

/* ---------- Landing ---------- */

.hero-body { gap: 26px; padding-block: 24px 104px; }
.hero-title { max-width: 12em; font-size: clamp(42px, 6vw, 76px); }
.hero-sub { font-size: 19px; }
.hero-actions { align-items: center; gap: 8px; }
.landing-body { background: rgba(10, 10, 12, 0.96); }
.band { border-top: 0; }
.band + .band .band-inner { padding-top: 0; }
.band-inner { padding-block: 96px; }
.band-title { margin-bottom: 36px; font-size: clamp(28px, 3.4vw, 38px); }
.how li::before { font-size: 32px; margin-bottom: 10px; }
.plan-desc { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }
.faq summary { font-size: 15.5px; }

/* One column edge for the whole landing page */
.band-inner,
.band-inner.narrow {
  max-width: 1200px;
  padding-left: max(24px, env(safe-area-inset-left, 0px));
  padding-right: max(24px, env(safe-area-inset-right, 0px));
}
.band-inner.narrow .faq { max-width: 760px; }
.site-foot {
  max-width: 1200px;
  margin: 0 auto;
  padding-left: max(24px, env(safe-area-inset-left, 0px));
  padding-right: max(24px, env(safe-area-inset-right, 0px));
}
.landing-body { border-top: 1px solid var(--line); }

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

/* Flat surfaces instead of glass */
.card,
.panel,
.ws-side,
.ws-main,
.cp-head {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.card, .panel { border: 1px solid var(--line); background: var(--panel); box-shadow: none; }
.ws-overlay { background: rgba(0, 0, 0, 0.6); }
.ws-overlay .card { box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5); }

/* ---------- Home: privilege and pricing ---------- */

.hero-eyebrow { margin: 0; font-size: 14px; font-weight: 500; color: var(--muted); }
.how p { max-width: 34ch; }
#how .fine { max-width: 70ch; margin-top: 36px; }

.price-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 40px;
  max-width: 880px;
  padding: 32px;
  border-radius: var(--radius);
  background: var(--surface);
}
.price-card .price { margin: 0 0 6px; }
.price-card .price span { font-size: 48px; }
.price-card .plan-desc { margin-bottom: 22px; }
.included { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; font-size: 15px; }
.included li { position: relative; padding-left: 26px; line-height: 1.5; }
.included li::before {
  content: "";
  position: absolute;
  top: 0.3em;
  left: 0;
  width: 14px;
  height: 8px;
  border-bottom: 2px solid var(--ok);
  border-left: 2px solid var(--ok);
  transform: rotate(-45deg) scale(0.8);
}

@media (max-width: 820px) {
  .price-card { grid-template-columns: minmax(0, 1fr); gap: 24px; padding: 24px; }
}

/* FAQ: a quiet plus/minus instead of the browser's triangle */
.faq summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; list-style: none; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; flex: none; font-size: 20px; font-weight: 300; color: var(--faint); }

/* The page itself is plain; the artwork lives only inside the hero panel. */
.scrim, body.dim .scrim { background: var(--app-bg); }

.hero { display: block; min-height: 0; }
.site-nav { height: 76px; padding-block: 0; }

.hero-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(1200px, calc(100% - 48px));
  height: calc(75vh - 76px);
  height: calc(75svh - 76px);
  min-height: 460px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 24px;
  background: url("assets/bg.png") center / cover no-repeat;
}

/* Darker in the middle, where the text sits */
.hero-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 75% at 50% 50%, rgba(8, 8, 10, 0.82) 0%, rgba(8, 8, 10, 0.62) 55%, rgba(8, 8, 10, 0.4) 100%);
}

.hero-panel .hero-body {
  position: relative;
  flex: none;
  align-items: center;
  width: 100%;
  max-width: 860px;
  margin: 0;
  padding: 40px 24px;
  text-align: center;
}

.hero-panel .hero-title {
  max-width: 14em;
  margin-inline: auto;
  font-size: clamp(36px, 5.2vw, 66px);
  line-height: 1.08;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.45);
}

.hero-panel .hero-sub {
  max-width: 36em;
  margin-inline: auto;
  font-size: 18px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.86);
}

.hero-panel .hero-eyebrow {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.hero-panel .hero-actions { justify-content: center; }
.hero-panel .btn-text { color: rgba(255, 255, 255, 0.85); }

.landing-body { margin-top: 32px; border-top: 0; background: none; }

@media (max-width: 820px) {
  .site-nav { height: 64px; }
  .hero-panel {
    width: calc(100% - 24px);
    height: auto;
    min-height: calc(75svh - 64px);
    border-radius: 18px;
  }
  .hero-panel .hero-body { padding: 48px 20px; }
  .hero-panel .hero-sub { font-size: 16px; }
}
.site-nav { width: min(1200px, calc(100% - 48px)); padding-left: 4px; padding-right: 4px; }
@media (max-width: 820px) { .site-nav { width: calc(100% - 24px); } }

/* ==========================================================================
   Home: calmer hero, rotating AI names, 3D globe, showcase, centered layout
   ========================================================================== */

@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Hero panel: dark base, dimmed artwork, globe, then text */
.hero-panel {
  background: #0a0a0c;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 0 1px var(--line);
  transform: scale(calc(1 - var(--p, 0) * 0.04));
  transform-origin: 50% 0;
  will-change: transform;
}
.hero-panel::before { content: none; }
.hero-art {
  position: absolute;
  inset: 0;
  background: url("assets/bg.png") center / cover no-repeat;
  opacity: 0.22;
  filter: grayscale(0.35);
}
.hero-art::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 65% 70% at 50% 45%, rgba(10, 10, 12, 0.9), rgba(10, 10, 12, 0.55) 70%, rgba(10, 10, 12, 0.35));
}
.globe { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-panel .hero-body {
  opacity: calc(1 - var(--p, 0) * 0.9);
  transform: translateY(calc(var(--p, 0) * -28px));
}
.hero-panel .hero-title { max-width: 16em; font-size: clamp(32px, 4.6vw, 58px); line-height: 1.12; text-shadow: none; }
.hero-panel .hero-sub { font-size: 19px; color: rgba(255, 255, 255, 0.82); }

/* Rotating AI names; the slot width is set by landing.js and eases between names */
.ai-rotator {
  position: relative;
  display: inline-block;
  vertical-align: baseline;
  white-space: nowrap;
  transition: width 0.6s cubic-bezier(0.65, 0, 0.25, 1);
}
.ai-sizer { display: inline-block; width: 0; visibility: hidden; }
.ai-word {
  position: absolute;
  top: 0;
  left: 0;
  font-style: italic;
  white-space: nowrap;
  background: linear-gradient(90deg, #ffffff, #c4caff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  opacity: 0;
  filter: blur(8px);
  transform: translateY(0.3em);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1), filter 0.6s ease;
}
.ai-word.is-on { opacity: 1; filter: none; transform: none; }

/* ---------- Showcase: 3D cards ---------- */

.band-sub { max-width: 46ch; margin: -18px auto 48px; font-size: 16px; line-height: 1.6; color: var(--muted); }

.stage {
  --tx: 0;
  --ty: 0;
  --sp: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
  max-width: 980px;
  margin: 0 auto;
  perspective: 1400px;
}
.card3d {
  transform-style: preserve-3d;
  transform: rotateX(calc(6deg + var(--sp) * 10deg + var(--ty) * -8deg)) rotateY(calc(var(--base) + var(--tx) * 12deg));
  transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.card3d.you { --base: 12deg; }
.card3d.store { --base: -12deg; }
.card3d-inner {
  min-height: 190px;
  padding: 24px 26px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(160deg, #1c1c21, #131316);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  text-align: left;
  animation: float 7s ease-in-out infinite;
}
.card3d.store .card3d-inner { animation-delay: -3.5s; }
@keyframes float {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -10px, 30px); }
}
.card3d-label { margin: 0 0 14px; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
.card3d-text { margin: 0; font-size: 18px; line-height: 1.55; }
.cipher-text { font: 13.5px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; color: rgba(196, 202, 255, 0.75); word-break: break-all; }
.caret { display: inline-block; width: 2px; height: 1.1em; margin-left: 2px; vertical-align: -0.15em; background: var(--paper); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* ---------- Centered sections ---------- */

.band-inner { text-align: center; }
.band-title { margin-inline: auto; }
.how { text-align: center; }
.how li { padding: 28px 22px; border-radius: 16px; transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), background 0.4s ease; }
.how li:hover { background: var(--surface); transform: perspective(800px) translateY(-4px) rotateX(3deg); }
.how p { margin-inline: auto; }
#how .fine { margin-inline: auto; }

.price-card {
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  gap: 28px;
  max-width: 620px;
  margin: 0 auto;
  padding: 40px 32px;
  text-align: center;
  transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.4s ease;
}
.price-card:hover { transform: translateY(-4px); box-shadow: 0 30px 60px rgba(0, 0, 0, 0.35); }
.included { display: inline-flex; text-align: left; }

.band-inner.narrow .faq { margin-inline: auto; text-align: left; }
.site-foot { flex-direction: column; justify-content: center; gap: 12px; text-align: center; }
.site-foot p { margin: 0; }

/* ---------- Scroll reveals (only when JS and motion are available) ---------- */

.reveal-ready [data-reveal] {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.9s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1);
  transition-delay: var(--d, 0ms);
}
.reveal-ready [data-reveal].in { opacity: 1; transform: none; }
/* The stage keeps its own 3D transforms on the cards, so it only fades and rises */
.reveal-ready .stage[data-reveal] { transform: translateY(40px) scale(0.97); }
.reveal-ready .stage[data-reveal].in { transform: none; }

@media (max-width: 820px) {
  .stage { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .card3d.you { --base: 6deg; }
  .card3d.store { --base: -6deg; }
  .card3d-text { font-size: 16px; }
  .band-sub { margin-top: -10px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-panel, .hero-panel .hero-body { transform: none; opacity: 1; }
}

/* Italic names lean past their box; give the last letter room so it isn't clipped */
.ai-word { padding: 0 0.16em 0.08em 0; }
.ai-rotator { margin-right: -0.16em; }

/* Tilting cards with a pointer-following sheen */
[data-tilt] {
  --rx: 0deg;
  --ry: 0deg;
  --gx: 50%;
  --gy: 0%;
  position: relative;
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.6s ease;
}
[data-tilt].is-tilting { transition: transform 0.12s linear, box-shadow 0.6s ease; }
[data-tilt]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at var(--gx) var(--gy), rgba(255, 255, 255, 0.09), transparent 55%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
[data-tilt].is-tilting::after { opacity: 1; }
[data-depth] { transform: translateZ(40px); }

/* How privilege works: cards with layered 3D icons */
.how li::before { display: none; }
.how li, .how li:hover { padding: 0; background: none; transform: none; }
.how-card {
  height: 100%;
  padding: 32px 26px 30px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(160deg, #18181c, #121215);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.how-card h3, .how-card p { transform: translateZ(18px); }

.plate {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto 22px;
  transform-style: preserve-3d;
  transform: translateZ(30px);
  animation: plate-float 8s ease-in-out infinite;
}
.how li:nth-child(2) .plate { animation-delay: -2.6s; }
.how li:nth-child(3) .plate { animation-delay: -5.2s; }
.plate > span { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 16px; }
.plate-back { background: rgba(196, 202, 255, 0.06); transform: translateZ(0) rotate(-8deg); }
.plate-mid { background: linear-gradient(145deg, rgba(196, 202, 255, 0.22), rgba(196, 202, 255, 0.04)); border: 1px solid rgba(196, 202, 255, 0.18); transform: translateZ(16px); }
.plate-icon { color: #e3e6ff; transform: translateZ(32px); }
@keyframes plate-float {
  0%, 100% { transform: translateZ(30px) rotateX(0deg) rotateY(0deg); }
  50% { transform: translateZ(30px) rotateX(10deg) rotateY(-12deg); }
}

/* Pricing: the card tilts and the price sits forward */
.price-wrap { perspective: 1200px; }
.price-card { border: 1px solid var(--line); background: linear-gradient(160deg, #19191d, #121215); box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05); }
.price-card:hover { transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)); }
.price-card .included, .price-card .plan-desc, .price-card .btn { transform: translateZ(20px); }

/* Scroll entrances rise in with depth */
.reveal-ready [data-reveal] { transform: perspective(1000px) translateY(34px) rotateX(14deg); transform-origin: 50% 100%; }
.reveal-ready [data-reveal].in { transform: none; }
.reveal-ready .faq[data-reveal] { transform: perspective(800px) rotateX(-60deg); transform-origin: 50% 0; }
.reveal-ready .faq[data-reveal].in { transform: none; }

/* Section headings get a hint of depth */
.band-title { text-shadow: 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 30px rgba(0, 0, 0, 0.5); }

@media (prefers-reduced-motion: reduce) {
  [data-tilt], .plate, .plate > span { transform: none !important; animation: none !important; }
}
/* Nothing shows through behind the page body any more, so skip the costly blur */
.landing-body { backdrop-filter: none; -webkit-backdrop-filter: none; }
/* Keep text flat inside tilting cards: crisper, and avoids 3D compositing glitches */
.price-card { transform-style: flat; }
.price-card .included, .price-card .plan-desc, .price-card .btn, [data-depth], .how-card h3, .how-card p { transform: none; }

/* Slightly stronger secondary text for readability */
:root { --faint: rgba(244, 244, 245, 0.54); }

/* ---------- Comparison and sales ---------- */
.compare-wrap { max-width: 900px; margin: 0 auto; overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; background: linear-gradient(160deg, #17171b, #111114); }
.compare { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 14.5px; text-align: left; }
.compare th, .compare td { padding: 16px 20px; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.5; }
.compare tr:last-child th, .compare tr:last-child td { border-bottom: 0; }
.compare thead th { font-size: 13px; font-weight: 500; color: var(--faint); }
.compare thead th:last-child { color: var(--paper); }
.compare tbody th { width: 30%; font-weight: 500; color: var(--muted); }
.compare td { color: var(--faint); }
.compare td:last-child { color: var(--paper); background: rgba(123, 227, 165, 0.04); }
.sales-line { margin: 16px 0 0; font-size: 13px; color: var(--muted); }
.sales-email { margin: 0; padding: 14px; border-radius: 10px; background: var(--surface); font: 16px ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; user-select: all; }
.site-foot .link-btn { color: var(--muted); font-size: 13px; text-decoration: none; }
.site-foot .link-btn:hover { color: var(--paper); }

  </style>
</head>
<body>
  <!-- Background (the page itself is plain; the artwork sits inside the hero panel) -->
  <div class="bg" aria-hidden="true">
    <div class="bg-layer"></div>
    <div class="scrim"></div>
  </div>

  <main id="app">
    <!-- Landing -->
    <section class="screen landing is-active" data-screen="hero">
      <div class="hero">
        <header class="site-nav">
          <div class="brand" role="img" aria-label="legal.xyz">
            <img class="brand-icon" src="assets/icon.png" alt="" />
            <span class="brand-word"><img src="assets/wordmark.png" alt="" /></span>
          </div>
          <nav class="nav-links" aria-label="Site">
            <button type="button" data-scroll="how">Privilege</button>
            <button type="button" data-scroll="pricing">Pricing</button>
            <a href="#security">Security</a>
          </nav>
          <button class="btn btn-primary btn-sm" type="button" data-start>Get started</button>
        </header>

        <div class="hero-panel" data-hero-panel>
        <div class="hero-art" aria-hidden="true"></div>
        <canvas class="globe" data-globe aria-hidden="true"></canvas>
        <div class="hero-body">
          <p class="hero-eyebrow">Attorney-client privilege, built in</p>
          <h1 class="hero-title">
            Chatting with
            <span class="ai-rotator" data-rotator aria-hidden="true"><span class="ai-sizer">ChatGPT</span><span class="ai-word is-on">ChatGPT</span><span class="ai-word">Claude</span><span class="ai-word">Gemini</span></span><span class="sr-only">AI chatbots</span>
            about your legal matters puts them at risk of being subpoenaed.
          </h1>
          <p class="hero-sub">legal.xyz gives your conversations real privacy.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" type="button" data-start>Get started</button>
            <button class="btn btn-text" type="button" data-scroll="how">How privilege works <span aria-hidden="true">→</span></button>
          </div>
        </div>
        </div>
      </div>

      <div class="landing-body">
        <section class="band showcase">
          <div class="band-inner">
            <h2 class="band-title" data-reveal>What you type, and what we store</h2>
            <p class="band-sub" data-reveal>Every message is encrypted on your device before it's saved. Anyone who subpoenas us gets the right-hand side.</p>
            <div class="stage" data-stage data-reveal>
              <div class="card3d you">
                <div class="card3d-inner">
                  <p class="card3d-label">You</p>
                  <p class="card3d-text"><span data-typed></span><span class="caret" aria-hidden="true"></span></p>
                </div>
              </div>
              <div class="card3d store">
                <div class="card3d-inner">
                  <p class="card3d-label">What legal.xyz stores</p>
                  <p class="card3d-text cipher-text" data-cipher-anim></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="band" id="compare">
          <div class="band-inner">
            <h2 class="band-title" data-reveal>Why not just use a chatbot?</h2>
            <div class="compare-wrap" data-reveal>
              <table class="compare">
                <thead>
                  <tr><th scope="col"><span class="sr-only">Question</span></th><th scope="col">Consumer AI chatbots</th><th scope="col">legal.xyz</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Privileged?</th><td>A federal court said no (2026)</td><td>Lawyer-directed and built to support privilege</td></tr>
                  <tr><th scope="row">Who can read it</th><td>The provider can access it and may disclose it</td><td>Only you and your lawyer</td></tr>
                  <tr><th scope="row">If the provider is subpoenaed</th><td>Readable conversations</td><td>Encrypted data only</td></tr>
                  <tr><th scope="row">Used for training</th><td>Often, unless you opt out</td><td>Never</td></tr>
                  <tr><th scope="row">Retention</th><td>Kept until you delete it</td><td>Auto-deletes on your schedule, with legal holds</td></tr>
                  <tr><th scope="row">Your lawyer</th><td>Not involved</td><td>Reviews, notes, legal hold and privilege log</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="band" id="how">
          <div class="band-inner">
            <h2 class="band-title" data-reveal>How privilege works</h2>
            <ol class="how">
              <li data-reveal>
                <div class="how-card" data-tilt>
                <div class="plate" aria-hidden="true"><span class="plate-back"></span><span class="plate-mid"></span><span class="plate-icon"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 16.5c1.2-1.6 2-1.6 2.6-.4.6 1.2 1.4 1.2 2.6-.6.5-.7 1.1-.9 1.8-.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span></div>
                <h3>Your lawyer directs it</h3>
                <p>Your lawyer signs an agreement that makes legal.xyz their agent. Courts have long extended privilege to experts working at a lawyer's direction.</p>
                </div>
              </li>
              <li data-reveal>
                <div class="how-card" data-tilt>
                <div class="plate" aria-hidden="true"><span class="plate-back"></span><span class="plate-mid"></span><span class="plate-icon"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m3 13 9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span></div>
                <h3>It stays about legal advice</h3>
                <p>Conversations are organized by legal matter, marked privileged, and flagged when they drift into business topics that privilege doesn't cover.</p>
                </div>
              </li>
              <li data-reveal>
                <div class="how-card" data-tilt>
                <div class="plate" aria-hidden="true"><span class="plate-back"></span><span class="plate-mid"></span><span class="plate-icon"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
                <h3>It's ready to defend</h3>
                <p>If a request ever comes, your lawyer already has the signed agreement and a privilege log to assert the claim.</p>
                </div>
              </li>
            </ol>
            <p class="fine" data-reveal>Whether a communication is privileged is decided by a court. legal.xyz is designed to give you the strongest possible claim, not a guarantee.</p>
          </div>
        </section>

        <section class="band" id="pricing">
          <div class="band-inner">
            <h2 class="band-title" data-reveal>Pricing</h2>
            <div class="price-wrap" data-reveal>
            <div class="price-card" data-tilt>
              <div>
                <p class="price" data-depth><span>$497</span> / month</p>
                <p class="plan-desc">One plan for your whole company. Everything included.</p>
                <button class="btn btn-primary" type="button" data-start>Get started</button>
                <p class="sales-line">Need single sign-on or a custom agreement? <button class="link-btn" type="button" data-sales-open>Talk to sales</button></p>
              </div>
              <ul class="included">
                <li>Unlimited matters, chats and documents</li>
                <li>Your whole team, with roles and access controls</li>
                <li>Counsel portal, legal hold and privilege log</li>
                <li>Encryption on your device, with zero access by us</li>
              </ul>
            </div>
            </div>
          </div>
        </section>

        <section class="band" id="faq">
          <div class="band-inner narrow">
            <h2 class="band-title" data-reveal>Questions</h2>
            <details class="faq" data-reveal><summary>Is legal.xyz subpoena-proof?</summary><p>No product can be. A subpoena to us returns only encrypted data, because we never hold your key. Your company can still be asked for its own chats; your lawyer can then claim privilege, and a court decides.</p></details>
            <details class="faq" data-reveal><summary>Why does my lawyer have to sign?</summary><p>Privilege covers communications made to get legal advice from a lawyer. A federal court found in 2026 that AI chats used without a lawyer weren't privileged. Your lawyer's direction is what gives you a real claim.</p></details>
            <details class="faq" data-reveal><summary>Can legal.xyz read my chats?</summary><p>No. They're encrypted on your device with a key protected by your password and recovery code, and we never receive either.</p></details>
            <details class="faq" data-reveal><summary>What if I forget my password?</summary><p>Use your recovery code. If both are lost, nobody can recover your chats, including us.</p></details>
            <details class="faq" data-reveal><summary>What happens when a lawsuit starts?</summary><p>Your lawyer places a legal hold, which pauses auto-delete, and can export a privilege log of protected conversations.</p></details>
          </div>
        </section>

        <footer class="site-foot">
          <img class="logo-sm" src="assets/logo.png" alt="legal.xyz" />
          <nav aria-label="Legal">
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
            <a href="#security">Security</a>
            <a href="#help">Help</a>
            <button class="link-btn" type="button" data-sales-open>Contact sales</button>
          </nav>
          <p>Not a law firm. Doesn't provide legal advice.</p>
        </footer>
      </div>
    </section>
  </main>

  <!-- Sales contact -->
  <div class="ws-overlay" data-overlay="sales" hidden>
    <div class="card">
      <h2>Talk to sales</h2>
      <p class="sub">For single sign-on, custom agreements, volume pricing or a walkthrough with your lawyer, email our team. We reply within one business day.</p>
      <p class="sales-email" data-sales-email>sales@legal.xyz</p>
      <div class="actions">
        <button class="btn btn-ghost" type="button" data-sales-close>Close</button>
        <button class="btn btn-primary" type="button" data-sales-copy>Copy email</button>
      </div>
    </div>
  </div>

  <script>
// Home page motion: rotating AI names in the headline, a 3D dot globe in the hero,
// the type-and-encrypt showcase, scroll reveals and a gentle hero scroll effect.
// Everything stops when off screen and is skipped for reduced motion.
(() => {
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const landing = $('[data-screen="hero"]');
  const onLanding = () => landing.classList.contains("is-active") && !document.hidden;

  // ---------- Rotating AI names ----------
  // The slot's width eases between names so the rest of the headline never jumps.

  function rotator() {
    const box = $("[data-rotator]");
    const words = $$(".ai-word", box);
    let i = 0;
    const fit = () => { box.style.width = `${words[i].offsetWidth}px`; };
    fit();
    addEventListener("resize", fit);
    document.fonts?.ready.then(fit);
    if (reduced) return;
    setInterval(() => {
      if (!onLanding()) return;
      words[i].classList.remove("is-on");
      i = (i + 1) % words.length;
      words[i].classList.add("is-on");
      fit();
    }, 2200);
  }

  // ---------- 3D dot globe ----------

  function globe() {
    const canvas = $("[data-globe]");
    const panel = $("[data-hero-panel]");
    const ctx = canvas.getContext("2d");
    const N = 1400;
    const golden = Math.PI * (3 - Math.sqrt(5));
    // Each dot gets its own twinkle phase and speed, like distant stars.
    const pts = Array.from({ length: N }, (_, k) => {
      const y = 1 - (k / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      return [Math.cos(golden * k) * r, y, Math.sin(golden * k) * r, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.7];
    });
    let t = 0;
    let w = 0, h = 0, rot = 0, mx = 0, my = 0, tx = 0, ty = 0, visible = true, raf = 0;

    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const R = Math.max(w * 0.62, h * 0.9);
      const cx = w / 2 + tx * 18;
      const cy = h + R * 0.42 + ty * 10;
      const ry = rot + tx * 0.25;
      const rx = -0.32 + ty * 0.1;
      const cy1 = Math.cos(ry), sy1 = Math.sin(ry), cx1 = Math.cos(rx), sx1 = Math.sin(rx);

      // Soft horizon glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.25);
      glow.addColorStop(0, "rgba(160, 170, 255, 0.10)");
      glow.addColorStop(1, "rgba(160, 170, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (const [x, y, z, phase, speed] of pts) {
        const X = x * cy1 + z * sy1;
        let Z = -x * sy1 + z * cy1;
        const Y = y * cx1 - Z * sx1;
        Z = y * sx1 + Z * cx1;
        const px = cx + X * R;
        const py = cy - Y * R;
        if (py > h + 4 || px < -4 || px > w + 4) continue;
        const depth = (Z + 1) / 2;
        const twinkle = 0.65 + 0.35 * Math.sin(t * speed + phase);
        ctx.globalAlpha = (Z > 0 ? 0.12 + depth * 0.5 : 0.05) * twinkle;
        ctx.fillStyle = "#dfe3f0";
        const s = 0.6 + depth * 1.1;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      raf = 0;
      if (!visible || !onLanding()) return;
      rot += 0.00035;
      t += 0.012;
      tx += (mx - tx) * 0.02;
      ty += (my - ty) * 0.02;
      draw();
      raf = requestAnimationFrame(loop);
    }
    const start = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };

    size();
    draw();
    addEventListener("resize", () => { size(); draw(); });
    panel.addEventListener("pointermove", (e) => {
      const r = panel.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width * 2 - 1;
      my = (e.clientY - r.top) / r.height * 2 - 1;
    });
    panel.addEventListener("pointerleave", () => { mx = my = 0; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(panel);
    document.addEventListener("visibilitychange", start);
    addEventListener("hashchange", () => setTimeout(start, 50));
    start();
  }

  // ---------- Type and encrypt ----------

  const QUESTIONS = [
    "Can we terminate the Main St. lease if the tenant is 90 days behind on rent?",
    "A former employee says we owe overtime. What's our exposure before we respond?",
    "The supplier missed delivery twice. Do we have grounds to cancel the contract?",
  ];
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const noise = (n) => Array.from({ length: n }, () => B64[Math.floor(Math.random() * 64)]).join("");

  function showcase() {
    const stage = $("[data-stage]");
    const typed = $("[data-typed]");
    const cipher = $("[data-cipher-anim]");
    let q = 0, running = false, timer = 0;

    if (reduced) {
      typed.textContent = QUESTIONS[0];
      cipher.textContent = noise(Math.round(QUESTIONS[0].length * 1.35)) + "==";
      return;
    }

    // Each typed character adds encrypted characters on the right; the tail keeps churning.
    function play() {
      const text = QUESTIONS[q];
      const total = Math.round(text.length * 1.35);
      let i = 0;
      let out = "";
      const step = () => {
        if (!running) return;
        if (i <= text.length) {
          typed.textContent = text.slice(0, i);
          const target = Math.round((i / text.length) * total);
          out = (out + noise(Math.max(0, target - out.length))).slice(0, target);
          cipher.textContent = out.slice(0, Math.max(0, out.length - 6)) + noise(Math.min(6, out.length));
          i += 1;
          timer = setTimeout(step, 28 + Math.random() * 30);
        } else {
          cipher.textContent = out + "==";
          timer = setTimeout(() => {
            q = (q + 1) % QUESTIONS.length;
            play();
          }, 3200);
        }
      };
      step();
    }

    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        play();
      } else if (!e.isIntersecting && running) {
        running = false;
        clearTimeout(timer);
      }
    }, { threshold: 0.3 }).observe(stage);

    // Cards tilt toward the pointer
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      stage.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      stage.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--tx", 0);
      stage.style.setProperty("--ty", 0);
    });
  }

  // ---------- Scroll reveals and hero scroll effect ----------

  function reveals() {
    if (reduced || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("reveal-ready");
    // Stagger siblings that reveal together
    $$(".how [data-reveal], .faq[data-reveal]").forEach((el) => {
      const i = [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal")).indexOf(el);
      el.style.setProperty("--d", `${i * 80}ms`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  function heroScroll() {
    if (reduced) return;
    const panel = $("[data-hero-panel]");
    const stage = $("[data-stage]");
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!onLanding()) return;
      const vh = innerHeight;
      const p = Math.min(1, Math.max(0, scrollY / (vh * 0.75)));
      panel.style.setProperty("--p", p.toFixed(3));
      // Cards straighten as they reach the middle of the screen
      const r = stage.getBoundingClientRect();
      const c = Math.min(1, Math.max(-1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
      stage.style.setProperty("--sp", c.toFixed(3));
    };
    addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // ---------- 3D tilt for cards ----------
  // Cards lean toward the pointer, with a soft sheen that follows it.

  function tilt() {
    if (reduced) return;
    $$("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--rx", `${((0.5 - y) * 10).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${((x - 0.5) * 12).toFixed(2)}deg`);
        card.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
        card.classList.add("is-tilting");
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.classList.remove("is-tilting");
      });
    });
  }

  // ---------- Smooth, slightly delayed wheel scrolling ----------
  // The page eases toward where the wheel points instead of jumping there. Touch,
  // keyboard and scrollbar keep their native behavior.

  function smoothScroll() {
    if (reduced) return;
    let target = scrollY;
    let current = scrollY;
    let raf = 0;
    const max = () => document.documentElement.scrollHeight - innerHeight;

    const step = () => {
      current += (target - current) * 0.09;
      const done = Math.abs(target - current) < 0.5;
      if (done) current = target;
      scrollTo({ top: current, behavior: "instant" });
      raf = done ? 0 : requestAnimationFrame(step);
    };

    addEventListener("wheel", (e) => {
      if (!landing.classList.contains("is-active") || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!raf) target = current = scrollY;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
      target = Math.min(max(), Math.max(0, target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: false });

    // Stay in sync when something else scrolls the page (links, keys, scrollbar).
    addEventListener("scroll", () => { if (!raf) target = current = scrollY; }, { passive: true });
  }

  rotator();
  tilt();
  smoothScroll();
  globe();
  showcase();
  reveals();
  heroScroll();
})();
  </script>
  <script>
// Page wiring: the logo intro, in-page links and the sales dialog.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Logo reveal and hero entrance
  $(".brand").classList.add("intro");
  $(".hero").classList.add("intro");

  // "How privilege works", "Pricing" and similar buttons scroll to their section
  $$("[data-scroll]").forEach((b) => b.addEventListener("click", () => {
    document.getElementById(b.dataset.scroll).scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }));

  // "Get started" buttons: point these at your sign-up page
  $$("[data-start]").forEach((b) => b.addEventListener("click", () => {
    // location.href = "/signup";
  }));

  // Talk to sales dialog
  const sales = $("[data-overlay=sales]");
  $$("[data-sales-open]").forEach((b) => b.addEventListener("click", () => {
    sales.hidden = false;
    $("[data-sales-copy]").focus();
  }));
  $("[data-sales-close]").addEventListener("click", () => { sales.hidden = true; });
  sales.addEventListener("keydown", (e) => { if (e.key === "Escape") sales.hidden = true; });
  sales.addEventListener("click", (e) => { if (e.target === sales) sales.hidden = true; });
  $("[data-sales-copy]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText("sales@legal.xyz");
      btn.textContent = "Copied";
    } catch {
      getSelection().selectAllChildren($("[data-sales-email]"));
      btn.textContent = "Selected";
    }
    setTimeout(() => { btn.textContent = "Copy email"; }, 1600);
  });
})();
  </script>
</body>
</html>
````
