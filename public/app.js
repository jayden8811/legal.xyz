// Front-end prototype of the onboarding flow. State lives in localStorage until
// a backend exists; the encryption key is generated here and never leaves the device.
(() => {
  const STORE = "legalxyz.onboarding";
  const STEPS = ["account", "lawyer", "signature", "security", "team"];
  const LABELS = { account: "Account", lawyer: "Lawyer", signature: "Signature", security: "Encryption", team: "Team" };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  };
  let state = read();
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const domainOf = (email) => (email || "").split("@")[1]?.toLowerCase() || "";

  // ---------- Rendering helpers ----------

  function bind() {
    $$("[data-bind]").forEach((el) => {
      if (state[el.dataset.bind]) el.textContent = state[el.dataset.bind];
    });
  }

  function fillAgreements() {
    const tpl = $("#agreement-text");
    $$("[data-agreement]").forEach((el) => el.replaceChildren(tpl.content.cloneNode(true)));
    bind();
  }

  function showScreen(name) {
    $$(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    document.body.classList.toggle("dim", name !== "hero");
  }

  function setError(form, msg, { warn = false, field } = {}) {
    const el = $("[data-error]", form);
    el.textContent = msg || "";
    el.classList.toggle("warn", warn);
    $$("[aria-invalid]", form).forEach((f) => f.removeAttribute("aria-invalid"));
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  }

  // Returns the first invalid field's message, using native constraints plus our email check.
  function validate(form) {
    for (const field of $$("input, textarea, select", form)) {
      if (field.type === "checkbox" && field.required && !field.checked) return { field, msg: "Please confirm the checkbox to continue." };
      if (field.required && !field.value.trim()) return { field, msg: `${labelOf(field)} is required.` };
      if (field.type === "email" && field.value && !EMAIL.test(field.value.trim())) return { field, msg: "Enter a valid email address." };
      if (field.minLength > 0 && field.value.length < field.minLength) return { field, msg: `${labelOf(field)} must be at least ${field.minLength} characters.` };
      if (field.pattern && field.value && !new RegExp(`^${field.pattern}$`).test(field.value)) return { field, msg: `${labelOf(field)} looks wrong.` };
    }
    return null;
  }
  const labelOf = (field) => field.closest("label")?.firstChild.textContent.trim() || "This field";

  const values = (form) => Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));

  // ---------- Client flow ----------

  function go(step) {
    // The workspace never unlocks past the signature step without a signed agreement.
    const idx = STEPS.indexOf(step);
    if ((idx > STEPS.indexOf("signature") || step === "done") && !state.signedAt) step = "signature";
    state.step = step;
    save();
    bind();
    showScreen("onboarding");

    $$(".card .step[data-step]").forEach((s) => s.classList.toggle("is-active", s.dataset.step === step));
    const cur = step === "done" ? STEPS.length : STEPS.indexOf(step);
    $$(".steps li").forEach((li, i) => {
      li.classList.toggle("done", i < cur);
      li.classList.toggle("current", i === cur);
    });
    $("[data-progress-label]").textContent = step === "done" ? "Setup complete" : `Step ${cur + 1} of ${STEPS.length} · ${LABELS[step]}`;

    if (step === "lawyer") prefill($('form[data-step="lawyer"]'), ["lawyerName", "lawyerEmail", "firm", "note"]);
    if (step === "signature") renderSignature();
    if (step === "security") renderKey();
    if (step === "done") renderSummary();

    // Move focus into the new step so keyboard users land in the right place.
    const first = $(`.step[data-step="${step}"].is-active`)?.querySelector("input, textarea, select, button:not([disabled])");
    if (first && step !== "signature") first.focus({ preventScroll: true });
  }

  function prefill(form, keys) {
    keys.forEach((k) => {
      const f = form.elements[k];
      if (f && state[k] && !f.value) f.value = state[k];
    });
  }

  function submit(form, handler) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const bad = validate(form);
      if (bad) return setError(form, bad.msg, { field: bad.field });
      setError(form, "");
      handler(values(form), form);
    });
  }

  // Hero
  $("[data-start]").addEventListener("click", () => go(state.step || "account"));

  // 1. Account (the password is never stored)
  submit($('form[data-step="account"]'), ({ company, name, email }) => {
    Object.assign(state, { company, name, email });
    go("lawyer");
  });

  // 2. Lawyer
  submit($('form[data-step="lawyer"]'), ({ lawyerName, lawyerEmail, firm, note }, form) => {
    if (lawyerEmail.toLowerCase() === (state.email || "").toLowerCase()) {
      return setError(form, "Your lawyer must be a different person from the account owner.", { field: form.elements.lawyerEmail });
    }
    Object.assign(state, { lawyerName, lawyerEmail, firm, note, invitedAt: Date.now() });
    delete state.signedAt;
    go("signature");
  });

  // Keep the agreement preview in step with what's typed.
  const lawyerForm = $('form[data-step="lawyer"]');
  lawyerForm.addEventListener("input", () => {
    ["lawyerName", "firm"].forEach((k) => {
      const v = lawyerForm.elements[k].value.trim();
      $$(`[data-agreement] [data-bind="${k}"]`, lawyerForm).forEach((el) => {
        el.textContent = v || (k === "firm" ? "the firm" : "counsel");
      });
    });
  });

  $$("[data-back]").forEach((b) => b.addEventListener("click", () => {
    const i = STEPS.indexOf(state.step);
    // Going back from team skips the signature screen, which has nothing to edit.
    go(state.step === "team" ? "security" : STEPS[Math.max(0, i - 1)]);
  }));

  // 3. Signature
  function renderSignature() {
    const dot = $("[data-status-box] .dot");
    if (state.signedAt) {
      $("[data-status]").textContent = `Signed by ${state.signer} · Bar #${state.bar} (${state.barState})`;
      dot.classList.remove("pulse");
      dot.classList.add("ok");
      setTimeout(() => state.step === "signature" && go("security"), 1100);
    } else {
      $("[data-status]").textContent = "Awaiting signature";
      dot.classList.add("pulse");
      dot.classList.remove("ok");
    }
  }

  $("[data-change-lawyer]").addEventListener("click", () => go("lawyer"));

  $("[data-resend]").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    let left = 30;
    btn.textContent = "Email sent";
    const t = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(t);
        btn.disabled = false;
        btn.textContent = "Resend email";
      } else if (left < 28) {
        btn.textContent = `Resend in ${left}s`;
      }
    }, 1000);
  });

  // 4. Security: AES-256-GCM key, generated and kept client-side
  let sessionKey = null;

  async function makeKey() {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    const hex = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
    sessionKey = hex.match(/.{4}/g).join("-");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
    state.keyFingerprint = [...digest.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join(":");
    save();
  }

  async function renderKey() {
    if (!state.keyFingerprint) await makeKey();
    const lost = !sessionKey;
    // After a reload the key is gone from memory; offer a fresh one since nothing is encrypted yet.
    $("[data-key]").textContent = lost ? `Key created earlier on this device · fingerprint ${state.keyFingerprint}` : sessionKey;
    $("[data-download-key]").disabled = $("[data-copy-key]").disabled = lost;
    $("[data-new-key]").hidden = !lost;
    $("[data-retention]").value = state.retention || "90";
  }

  $("[data-new-key]").addEventListener("click", async () => {
    await makeKey();
    $("[data-key-saved]").checked = false;
    $("[data-security-continue]").disabled = true;
    renderKey();
  });

  $("[data-download-key]").addEventListener("click", () => {
    const text = `legal.xyz workspace key\nCompany: ${state.company}\nFingerprint: ${state.keyFingerprint}\n\n${sessionKey}\n\nKeep this file offline. legal.xyz cannot recover it.\n`;
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([text], { type: "text/plain" })),
      download: "legalxyz-key.txt",
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  });

  $("[data-copy-key]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(sessionKey);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Copy failed";
    }
    setTimeout(() => { btn.textContent = "Copy"; }, 1600);
  });

  $("[data-retention]").addEventListener("change", (e) => { state.retention = e.target.value; save(); });
  $("[data-key-saved]").addEventListener("change", (e) => { $("[data-security-continue]").disabled = !e.target.checked; });
  $("[data-security-continue]").addEventListener("click", () => {
    state.retention = $("[data-retention]").value;
    go("team");
  });

  // 5. Team: catch typos and flag outside domains, since sharing outside the company can waive privilege.
  const teamForm = $('form[data-step="team"]');
  let externalAcknowledged = "";
  teamForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = teamForm.elements.team.value;
    const emails = [...new Set(raw.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
    const invalid = emails.filter((m) => !EMAIL.test(m));
    if (invalid.length) return setError(teamForm, `Check these addresses: ${invalid.join(", ")}`, { field: teamForm.elements.team });

    const own = domainOf(state.email);
    const external = emails.filter((m) => domainOf(m) !== own);
    if (external.length && externalAcknowledged !== external.join()) {
      externalAcknowledged = external.join();
      $("[data-team-submit]").textContent = "Invite anyway";
      return setError(teamForm, `${external.join(", ")} ${external.length > 1 ? "are" : "is"} outside @${own}. Inviting outsiders can waive privilege.`, { warn: true });
    }
    setError(teamForm, "");
    state.team = emails;
    go("done");
  });
  teamForm.elements.team.addEventListener("input", () => {
    externalAcknowledged = "";
    $("[data-team-submit]").textContent = "Finish setup";
    setError(teamForm, "");
  });

  // Done
  function renderSummary() {
    $("[data-summary-counsel]").textContent = `${state.signer || state.lawyerName}, ${state.firm} · Bar #${state.bar} (${state.barState})`;
    const days = Number(state.retention || 90);
    $("[data-summary-retention]").textContent = days >= 365 ? "After 1 year" : `After ${days} days`;
    const n = (state.team || []).length;
    $("[data-summary-team]").textContent = n ? `${n} invite${n > 1 ? "s" : ""} sent` : "Just you";
  }

  $("[data-restart]").addEventListener("click", () => {
    state = {};
    sessionKey = null;
    save();
    $$("form").forEach((f) => f.reset());
    $("[data-key-saved]").checked = false;
    $("[data-security-continue]").disabled = true;
    location.hash = "";
    route({ initial: true });
  });

  // ---------- Counsel signing page ----------

  const signForm = $('[data-sign="form"]');

  function renderSign() {
    bind();
    fillAgreements();
    let view = "form";
    if (!state.lawyerEmail) view = "invalid";
    else if (state.signedAt) view = "signed";
    $$("[data-sign]").forEach((s) => s.classList.toggle("is-active", s.dataset.sign === view));
    const note = $("[data-note]");
    note.hidden = !state.note;
    note.textContent = state.note ? `“${state.note}” — ${state.name}` : "";
    if (view === "form" && !signForm.elements.signer.value) signForm.elements.signer.value = state.lawyerName || "";
    showScreen("sign");
  }

  submit(signForm, ({ signer, bar, barState }) => {
    Object.assign(state, { signer, bar, barState: barState.toUpperCase(), signedAt: Date.now() });
    save();
    renderSign();
  });

  // ---------- Background glitch ----------
  // Short bursts of offset slices at random intervals; skipped for reduced motion.

  const slices = $$(".glitch");
  const rand = (a, b) => a + Math.random() * (b - a);

  function frame() {
    slices.forEach((el) => {
      if (Math.random() < 0.35) {
        el.style.opacity = "0";
        return;
      }
      const top = rand(0, 85);
      el.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - rand(2, 14))}% 0)`;
      el.style.transform = `translateX(${rand(-40, 40)}px)`;
      el.style.opacity = String(rand(0.6, 1));
    });
  }

  function burst(duration = rand(180, 520)) {
    const start = performance.now();
    const tick = () => {
      if (performance.now() - start > duration) {
        slices.forEach((el) => { el.style.opacity = "0"; });
        return;
      }
      frame();
      setTimeout(tick, rand(40, 90));
    };
    tick();
  }

  function scheduleGlitch() {
    if (reducedMotion) return;
    setTimeout(() => {
      if (!document.hidden) burst();
      scheduleGlitch();
    }, rand(2600, 6500));
  }

  // ---------- Hero intro ----------

  function playIntro() {
    const brand = $(".brand");
    brand.classList.remove("intro");
    void brand.offsetWidth; // restart the CSS animation
    brand.classList.add("intro");
    if (!reducedMotion) {
      setTimeout(() => burst(260), 120);
      setTimeout(() => burst(420), 1150); // glitch as the word swipes in
    }
    $("[data-start]").textContent = state.step && state.step !== "account" ? "Continue setup" : "Get started";
  }

  // ---------- Routing ----------
  // #sign is the link emailed to counsel; everything else is the client's view.

  // A fresh page load always opens on the hero (with "Continue setup" for returning users).
  function route({ initial = false } = {}) {
    if (location.hash === "#sign") return renderSign();
    if (state.step && !initial) return go(state.step);
    showScreen("hero");
    playIntro();
  }

  // Keep tabs in sync, e.g. counsel signs in one tab while the client waits in another.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORE) return;
    state = read();
    route();
  });
  window.addEventListener("hashchange", route);

  fillAgreements();
  route({ initial: true });
  scheduleGlitch();
})();
