// Home page: "How?", the access application, and the contact screen.
// Shared by the app and the standalone homepage/ copy; routing calls LegalHome.setApply.
window.LegalHome = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- How? ----------

  // "How?" fades the line out, types the short answer, then fades in the detail under it; again, back.
  const howBtn = $("[data-how]");
  const howSub = $("[data-how-sub]");
  const typedHead = $("[data-typed-head]");
  const headText = typedHead.previousElementSibling.textContent.trim().replace("? ", "?\n"); // "How?" on its own line
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
  function setHow(showHow) {
    howBtn.setAttribute("aria-pressed", String(showHow));
    $$(".home-line").forEach((l) => {
      const on = (l.dataset.line === "how") === showHow;
      l.classList.toggle("is-on", on);
      l.setAttribute("aria-hidden", String(!on));
    });
    clearTimeout(typing);
    typedHead.textContent = "";
    typedHead.classList.remove("is-typing");
    howSub.classList.remove("is-shown");
    howSub.hidden = !showHow;
    if (!showHow) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typedHead.textContent = headText;
      howSub.classList.add("is-shown");
      return;
    }
    // after the old line fades out
    typing = setTimeout(() => typeInto(typedHead, headText, () => howSub.classList.add("is-shown")), 450);
  }
  howBtn.addEventListener("click", () => {
    if (!$("[data-apply]").hidden) {
      if (location.hash === "#apply") location.hash = "";
      setApply(false);
    }
    setHow(howBtn.getAttribute("aria-pressed") !== "true");
  });

  // ---------- Get access ----------

  // Personal mailbox providers; applications need a work address.
  const PERSONAL = /^(gmail|googlemail|yahoo|ymail|rocketmail|hotmail|outlook|live|msn|aol|icloud|me|mac|proton|protonmail|pm|gmx|mail|yandex|zoho|hey|fastmail|tutanota|tuta|qq|163|126|comcast|verizon|att|sbcglobal)\.[a-z.]+$/i;

  const apply = $("[data-apply]");
  const form = $("[data-apply-form]");
  const done = $("[data-apply-done]");
  const accessBtn = $("[data-get-access]");
  const formError = $("[data-apply-error]");
  const blank = form.innerHTML;

  function setApply(open) {
    const hero = $('[data-screen="hero"]');
    hero.classList.toggle("is-applying", open);
    apply.hidden = !open;
    accessBtn.textContent = open ? "Back" : "Get access";
    if (!open) return;
    setHow(false);
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

  accessBtn.addEventListener("click", () => {
    location.hash = location.hash === "#apply" ? "" : "apply";
  });

  function fieldError(field, msg) {
    const box = field.closest(".apply-field");
    const out = $(".apply-field-error", box);
    out.textContent = msg || "";
    if (msg) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
    return !msg;
  }

  function validate() {
    let first = null;
    for (const f of $$("input, select, textarea", form)) {
      if (f.type === "checkbox" || f.name === "website") continue;
      const v = f.value.trim();
      let msg = "";
      if (f.required && !v) msg = "Required.";
      else if (f.name === "workEmail") {
        const domain = v.split("@")[1] || "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Enter a valid email address.";
        else if (PERSONAL.test(domain)) msg = "Use your work email, not a personal one.";
      } else if (f.name === "phone" && v && v.replace(/\D/g, "").length < 7) msg = "Enter a valid phone number.";
      if (!fieldError(f, msg) && !first) first = f;
    }
    if (first) first.focus();
    return !first;
  }

  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid")) fieldError(e.target, "");
  });

  // Sends to the endpoint set on the form (data-apply-endpoint), e.g. a Formspree form or
  // server/apply-worker.js. With none set, the prototype keeps applications in this browser.
  async function send(entry) {
    const endpoint = form.dataset.applyEndpoint;
    if (!endpoint) {
      console.warn("legal.xyz: no data-apply-endpoint set; application kept in this browser only.");
      const key = "legalxyz.applications";
      let list = [];
      try { list = JSON.parse(localStorage.getItem(key)) || []; } catch {}
      list.push(entry);
      try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
      return;
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...entry, _subject: `legal.xyz application: ${entry.company}` }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";
    if (!validate()) return;
    const data = Object.fromEntries(new FormData(form));
    if (data.website) return; // honeypot: bots fill hidden fields
    const entry = {
      name: data.fullName.trim(),
      email: data.workEmail.trim().toLowerCase(),
      company: data.companyName.trim(),
      seats: data.seats,
      matters: data.matters.trim(),
      currentApproach: data.current.trim(),
      phone: (data.phone || "").trim(),
      contactConsent: data.consent === "yes",
      submittedAt: new Date().toISOString(),
    };
    const btn = $("[type=submit]", form);
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      await send(entry);
    } catch {
      btn.disabled = false;
      btn.textContent = "Apply for access";
      formError.textContent = "Something went wrong sending your application. Please try again, or email contact@legal.xyz.";
      return;
    }
    form.hidden = true;
    done.hidden = false;
    accessBtn.textContent = "Get access";
    $$(".home-apply-intro", apply).forEach((el) => { el.hidden = true; });
    // Leave #apply without a navigation, so "Get access" can open a fresh form.
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
