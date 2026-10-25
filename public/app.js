// Front-end prototype of the onboarding flow. State lives in localStorage until
// a backend exists; the encryption key is generated here and never leaves the device.
(() => {
  const STORE = "legalxyz.onboarding";
  const ORDER = ["account", "lawyer", "signature", "key", "team", "done"];

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  };
  const state = load();
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function showScreen(name) {
    $$(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
  }

  function bind() {
    $$("[data-bind]").forEach((el) => { el.textContent = state[el.dataset.bind] || ""; });
  }

  function go(step) {
    // The workspace never unlocks past the signature step without a signed agreement.
    if (ORDER.indexOf(step) > ORDER.indexOf("signature") && !state.signedAt) step = "signature";
    state.step = step;
    save();
    bind();
    showScreen("onboarding");
    $$(".card .step").forEach((s) => s.classList.toggle("is-active", s.dataset.step === step));
    const idx = ORDER.indexOf(step);
    $$(".steps li").forEach((li) => {
      const i = ORDER.indexOf(li.dataset.step);
      li.classList.toggle("done", i < idx);
      li.classList.toggle("current", i === idx);
    });
    if (step === "signature") renderSignature();
    if (step === "key") renderKey();
  }

  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  // Hero
  $("[data-go]").addEventListener("click", (e) => go(state.step || e.currentTarget.dataset.go));

  // 1. Account (password is not persisted)
  $('form[data-step="account"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const { company, name, email } = formData(e.target);
    Object.assign(state, { company, name, email });
    go("lawyer");
  });

  // 2. Lawyer
  const lawyerForm = $('form[data-step="lawyer"]');
  lawyerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { lawyerName, lawyerEmail, firm } = formData(e.target);
    if (lawyerEmail.toLowerCase() === (state.email || "").toLowerCase()) {
      alert("Your lawyer must be a separate person from the account owner.");
      return;
    }
    Object.assign(state, { lawyerName, lawyerEmail, firm, invitedAt: Date.now() });
    go("signature");
  });
  $$("[data-back]").forEach((b) => b.addEventListener("click", () => go(ORDER[ORDER.indexOf(state.step) - 1])));

  // 3. Signature
  function renderSignature() {
    const status = $("[data-status]");
    const dot = $(".status .dot");
    if (state.signedAt) {
      status.textContent = `Signed by ${state.signer} (Bar #${state.bar}, ${state.barState})`;
      dot.classList.remove("pulse");
      dot.classList.add("ok");
      setTimeout(() => go("key"), 900);
    }
  }
  $("[data-resend]").addEventListener("click", (e) => {
    e.currentTarget.textContent = "Link resent";
    setTimeout(() => { e.currentTarget.textContent = "Resend link"; }, 2000);
  });

  // Lawyer's signing view
  $("[data-sign-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    const { signer, bar, state: barState } = formData(e.target);
    Object.assign(state, { signer, bar, barState: barState.toUpperCase(), signedAt: Date.now() });
    save();
    location.hash = "";
    go("signature");
  });

  // 4. Encryption key — AES-256-GCM, generated and kept client-side
  async function renderKey() {
    if (!state.keyFingerprint) {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
      const hex = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
      sessionKey = hex.match(/.{4}/g).join("-");
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
      state.keyFingerprint = [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
      save();
    }
    $("[data-key]").textContent = sessionKey || `Key already created on this device · fingerprint ${state.keyFingerprint}`;
    $("[data-download-key]").disabled = $("[data-copy-key]").disabled = !sessionKey;
  }
  let sessionKey = null;

  $("[data-download-key]").addEventListener("click", () => {
    const blob = new Blob([`legal.xyz workspace key for ${state.company}\n\n${sessionKey}\n`], { type: "text/plain" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "legalxyz-key.txt" });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("[data-copy-key]").addEventListener("click", (e) => {
    navigator.clipboard?.writeText(sessionKey).then(() => {
      e.currentTarget.textContent = "Copied";
    });
  });
  $("[data-key-saved]").addEventListener("change", (e) => { $("[data-key-continue]").disabled = !e.target.checked; });
  $("[data-key-continue]").addEventListener("click", () => go("team"));

  // 5. Team
  $('form[data-step="team"]').addEventListener("submit", (e) => {
    e.preventDefault();
    state.team = formData(e.target).team.split(",").map((s) => s.trim()).filter(Boolean);
    go("done");
  });

  $("[data-reset]").addEventListener("click", () => {
    alert("Workspace coming next.");
  });

  // Routing: #sign is the link emailed to counsel
  function route() {
    if (location.hash === "#sign") {
      bind();
      showScreen("sign");
    } else if (state.step) {
      go(state.step);
    } else {
      showScreen("hero");
    }
  }
  window.addEventListener("hashchange", route);
  route();
})();
