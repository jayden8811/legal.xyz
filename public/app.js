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
    document.body.classList.toggle("dim", name !== "hero" && name !== "contact");
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
      if (field.type === "checkbox" && field.required && !field.checked) {
        return { field, msg: field.name === "terms" ? "Agree to the Terms of Service and Privacy Policy to continue." : "Please confirm the checkbox to continue." };
      }
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
    if ((idx > STEPS.indexOf("signature") || step === "done" || step === "workspace") && !state.signedAt) step = "signature";
    state.step = step;
    save();
    bind();

    if (step === "workspace") {
      showScreen("workspace");
      window.LegalWorkspace.open(state, save);
      return;
    }
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
    if (step === "security") renderSecurity();
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
  $$("[data-start]").forEach((b) => b.addEventListener("click", () => go(state.step || "account")));

  // 1. Account (the password is never stored; it only protects the encryption key)
  submit($('form[data-step="account"]'), ({ company, name, email, password }) => {
    Object.assign(state, { company, name, email });
    window.LegalAnalytics.track("onboarding_started");
    pendingPassword = password;
    go("lawyer");
  });

  // 2. Lawyer
  submit($('form[data-step="lawyer"]'), ({ lawyerName, lawyerEmail, firm, note }, form) => {
    if (lawyerEmail.toLowerCase() === (state.email || "").toLowerCase()) {
      return setError(form, "Your lawyer must be a different person from the account owner.", { field: form.elements.lawyerEmail });
    }
    Object.assign(state, { lawyerName, lawyerEmail, firm, note, invitedAt: Date.now() });
    window.LegalAnalytics.track("lawyer_invited");
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
    } else if (state.revokedAt) {
      $("[data-status]").textContent = `Counsel ended the agreement on ${new Date(state.revokedAt).toLocaleDateString()}. Ask them to sign again, or add new counsel.`;
      dot.classList.add("pulse");
      dot.classList.remove("ok");
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

  // 4. Security: the data key is wrapped by the account password and a recovery code.
  // The password is held in memory only, from the account step until the key is created.
  let pendingPassword = null;
  let recoveryCode = null;
  const V = window.LegalVault;

  function renderSecurity() {
    const needsPassword = !recoveryCode && !pendingPassword;
    $("[data-sec-password]").hidden = !needsPassword;
    $("[data-sec-code]").hidden = needsPassword;
    $("[data-sec-pw-label]").textContent = V.hasRing()
      ? "Enter your password to create a new recovery code"
      : "Confirm your account password";
    if (!needsPassword && !recoveryCode) protect(pendingPassword);
    if (recoveryCode) $("[data-recovery]").textContent = recoveryCode;
    $("[data-retention]").value = state.retention || "90";
  }

  async function protect(password) {
    const err = $("[data-sec-error]");
    err.textContent = "";
    if (V.hasRing()) {
      // Returning after a reload: the old code was never confirmed, so issue a fresh one.
      recoveryCode = await V.newRecovery(password);
      if (!recoveryCode) {
        err.textContent = "That password doesn't match this workspace.";
        return;
      }
    } else {
      const made = await V.create(password);
      recoveryCode = made.code;
      state.keyFingerprint = made.fingerprint;
      save();
    }
    pendingPassword = null;
    renderSecurity();
  }

  $("[data-sec-create]").addEventListener("click", () => {
    const pw = $("[data-sec-pw]").value;
    if (pw.length < 12) {
      $("[data-sec-error]").textContent = "Your password is at least 12 characters.";
      return;
    }
    $("[data-sec-pw]").value = "";
    protect(pw);
  });

  $("[data-download-key]").addEventListener("click", () => {
    const text = `legal.xyz recovery code\nCompany: ${state.company}\n\n${recoveryCode}\n\nUse this if you forget your password. legal.xyz cannot reset it for you.\n`;
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([text], { type: "text/plain" })),
      download: "legalxyz-recovery-code.txt",
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  });

  $("[data-copy-key]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      btn.textContent = "Copied";
    } catch {
      // Fall back to selecting the code so it can be copied by hand.
      getSelection().selectAllChildren($("[data-recovery]"));
      btn.textContent = "Selected";
    }
    setTimeout(() => { btn.textContent = "Copy"; }, 1600);
  });

  $("[data-retention]").addEventListener("change", (e) => { state.retention = e.target.value; save(); });
  $("[data-key-saved]").addEventListener("change", (e) => { $("[data-security-continue]").disabled = !e.target.checked; });
  $("[data-security-continue]").addEventListener("click", () => {
    state.retention = $("[data-retention]").value;
    recoveryCode = null;
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

  $("[data-open-workspace]").addEventListener("click", () => go("workspace"));

  async function resetDemo() {
    await window.LegalVault.clear();
    try { ["legalxyz.analytics", "legalxyz.counsel"].forEach((k) => localStorage.removeItem(k)); } catch {}
    state = {};
    save();
    location.hash = "";
    location.reload();
  }

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

  // The agreement as plain text, with the names filled in, for the signed record.
  function agreementPlain() {
    const box = document.createElement("div");
    box.append($("#agreement-text").content.cloneNode(true));
    box.querySelectorAll("[data-bind]").forEach((el) => { el.textContent = state[el.dataset.bind] || el.textContent; });
    return [...box.querySelectorAll("p, li")].map((n, i) => (n.tagName === "LI" ? `${i}. ` : "") + n.textContent.trim()).join("\n\n");
  }

  submit(signForm, async ({ signer, bar, barState }) => {
    // Counsel's key pair is made on counsel's device; only the public half is shared.
    const counselPublicKey = await V.createCounselKeys();
    const agreementText = agreementPlain();
    Object.assign(state, {
      signer, bar, barState: barState.toUpperCase(), signedAt: Date.now(),
      barStatus: "pending", counselPublicKey, agreementText, agreementHash: await V.sha256(agreementText),
    });
    window.LegalAnalytics.track("agreement_signed");
    delete state.revokedAt;
    save();
    renderSign();
  });

  // ---------- Hero intro ----------

  function playIntro() {
    const label = state.step === "workspace" ? "Open workspace" : state.step && state.step !== "account" ? "Continue setup" : "Get started";
    $$("[data-start]:not([data-fixed-label])").forEach((b) => { b.textContent = label; });
  }

  // ---------- Policy pages ----------

  const PAGES = ["terms", "privacy", "dpa", "security", "transparency", "help", "disclosure", "privilege", "pricing"];

  function renderPage(name) {
    $("[data-page-body]").replaceChildren($(`#page-${name}`).content.cloneNode(true));
    showScreen("page");
    window.scrollTo(0, 0);
    if (name === "help") wireHelp();
  }

  // Help center: filter articles as you type.
  function wireHelp() {
    const input = $("[data-help-search]");
    const articles = $$("[data-page-body] .help-article");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      articles.forEach((a) => {
        const hit = !q || a.textContent.toLowerCase().includes(q);
        a.hidden = !hit;
        shown += hit;
      });
      $("[data-help-empty]").hidden = shown > 0;
    });
  }

  // Skip link: move focus without touching the URL hash (which drives routing).
  $("[data-skip]").addEventListener("click", (e) => {
    e.preventDefault();
    const target = $(".screen.is-active");
    target.setAttribute("tabindex", "-1");
    target.focus();
  });

  // ---------- Home ----------

  // "How?" crossfades the line to the short answer and types out the detail under it; again, back.
  const howBtn = $("[data-how]");
  const howSub = $("[data-how-sub]");
  const typed = $("[data-typed]", howSub);
  const subText = $(".sr-only", howSub).textContent.trim();
  let typing = 0;
  howBtn.addEventListener("click", () => {
    const showHow = howBtn.getAttribute("aria-pressed") !== "true";
    howBtn.setAttribute("aria-pressed", String(showHow));
    $$(".home-line").forEach((l) => {
      const on = (l.dataset.line === "how") === showHow;
      l.classList.toggle("is-on", on);
      l.setAttribute("aria-hidden", String(!on));
    });
    clearTimeout(typing);
    typed.textContent = "";
    howSub.hidden = !showHow;
    if (!showHow) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typed.textContent = subText;
      return;
    }
    let i = 0;
    const step = () => {
      typed.textContent = subText.slice(0, ++i);
      if (i < subText.length) typing = setTimeout(step, 22);
    };
    typing = setTimeout(step, 550); // after the crossfade
  });

  // "Get access" is a placeholder until access requests open.
  $("[data-get-access]").addEventListener("click", () => {});

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

  // ---------- Sales contact ----------
  const sales = $("[data-overlay=sales]");
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-sales-open]")) return;
    sales.hidden = false;
    $("[data-sales-copy]").focus();
  });
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

  // ---------- Policy viewer ----------

  const policy = $("[data-overlay=policy]");
  let policyReturn = null;
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-policy]");
    if (!link) return;
    e.preventDefault();
    policyReturn = link;
    $("[data-policy-body]").replaceChildren($(`#page-${link.dataset.policy}`).content.cloneNode(true));
    policy.hidden = false;
    $("[data-policy-close]").focus();
  });
  const closePolicy = () => {
    policy.hidden = true;
    policyReturn?.focus();
  };
  $("[data-policy-close]").addEventListener("click", closePolicy);
  policy.addEventListener("click", (e) => { if (e.target === policy) closePolicy(); });
  policy.addEventListener("keydown", (e) => { if (e.key === "Escape") closePolicy(); });

  // ---------- Password strength ----------

  function strength(pw) {
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (pw.length < 12) return { level: 0, label: pw ? "Too short" : "" };
    return score >= 4 ? { level: 3, label: "Strong" } : score >= 3 ? { level: 2, label: "Good" } : { level: 1, label: "Fair. Longer is better; a short sentence works well." };
  }

  $$("[data-meter]").forEach((input) => {
    const meter = document.createElement("div");
    meter.className = "meter";
    meter.innerHTML = '<span class="meter-bar"><span></span></span><span class="meter-label" aria-live="polite"></span>';
    input.after(meter);
    input.addEventListener("input", () => {
      const { level, label } = strength(input.value);
      meter.dataset.level = String(level);
      meter.querySelector(".meter-label").textContent = label;
    });
  });

  // ---------- Demo controls ----------
  // Everything that stands in for a backend lives in one small panel.

  const demoPanel = $("[data-demo-panel]");
  const demoToggle = $("[data-demo-toggle]");
  let resetArmed = false;

  function renderDemo() {
    const box = $("[data-demo-actions]");
    box.replaceChildren();
    const hash = location.hash.slice(1);
    const add = (label, fn, cls = "") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `demo-action ${cls}`;
      b.textContent = label;
      b.addEventListener("click", fn);
      box.append(b);
    };
    if ($('[data-screen="hero"]').classList.contains("is-active")) add(state.step ? "Open the app" : "Start sign-up", () => {
      demoPanel.hidden = true;
      go(state.step || "account");
    });
    if (state.lawyerEmail && !state.signedAt && hash !== "sign") add("Sign as the lawyer", () => { location.hash = "sign"; });
    if (state.signedAt && hash !== "counsel") add("Open the lawyer's portal", () => { location.hash = "counsel"; });
    if (hash === "sign" || hash === "counsel") add("Back to the client", () => { location.hash = ""; });
    if (state.bar && state.barStatus !== "verified") {
      add("Mark bar number verified", () => {
        state.barStatus = "verified";
        save();
        route();
      });
    }
    add(resetArmed ? "Click again to erase everything" : "Reset demo", () => {
      if (resetArmed) return resetDemo();
      resetArmed = true;
      renderDemo();
      setTimeout(() => { resetArmed = false; renderDemo(); }, 4000);
    }, "danger");
  }

  demoToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    demoPanel.hidden = !demoPanel.hidden;
    demoToggle.setAttribute("aria-expanded", String(!demoPanel.hidden));
    renderDemo();
  });
  demoPanel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    demoPanel.hidden = true;
    demoToggle.setAttribute("aria-expanded", "false");
  });

  // ---------- Routing ----------
  // #sign is the link emailed to counsel, #counsel is counsel's portal, and the policy
  // pages have their own hashes; everything else is the client's view.

  // A fresh page load always opens on the landing page (with "Continue setup" for returning users).
  function route({ initial = false } = {}) {
    if (!demoPanel.hidden) renderDemo();
    const hash = location.hash.slice(1);
    if (hash === "sign") return renderSign();
    if (hash === "contact") return showScreen("contact");
    if (hash === "counsel") {
      showScreen("counsel");
      return window.LegalCounsel.open(state, save);
    }
    if (PAGES.includes(hash)) return renderPage(hash);
    if (state.step && !initial) return go(state.step);
    showScreen("hero");
    window.scrollTo(0, 0);
    playIntro();
  }

  // Keep tabs in sync, e.g. counsel signs in one tab while the client waits in another.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORE) return;
    state = read();
    route();
  });
  // Leaving a policy page returns to the landing page rather than jumping into setup.
  let lastHash = location.hash;
  window.addEventListener("hashchange", () => {
    const from = lastHash.slice(1);
    lastHash = location.hash;
    route({ initial: PAGES.includes(from) || from === "contact" });
  });

  fillAgreements();
  route({ initial: true });

  // Installable app: cache the shell for offline start. Not available in sandboxed previews.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
