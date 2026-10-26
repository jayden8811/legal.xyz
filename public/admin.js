// Applications admin: lists access applications, tallies what people want, exports CSV.
// Reads from the Worker's GET /applications (server/README.md), or, with no endpoint set,
// from applications submitted in this browser by the prototype.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const SETTINGS = "legalxyz.admin";
  const LOCAL = "legalxyz.applications";
  const SEATS = ["1-2", "3-5", "6-10", "11-25", "25+"];

  let apps = [];
  let open = new Set();

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  let settings = read(SETTINGS, {});

  const note = (msg, error = false) => {
    const el = $("[data-note]");
    el.textContent = msg || "";
    el.classList.toggle("error", error);
  };
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids.filter((k) => k != null));
    return n;
  };
  const when = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const time = (a) => a.receivedAt || a.submittedAt;

  // ---------- Loading ----------

  async function load() {
    note("");
    $("[data-refresh]").disabled = true;
    try {
      if (!settings.endpoint) {
        apps = read(LOCAL, []).slice().reverse();
        note("Showing applications submitted from this browser (prototype). Add your endpoint and admin token in Settings to see live applications.");
      } else {
        const base = settings.endpoint.replace(/\/+$/, "");
        const res = await fetch(`${base}/applications`, { headers: { Authorization: `Bearer ${settings.token || ""}` } });
        if (res.status === 401) throw new Error("The admin token was rejected. Check it in Settings.");
        if (!res.ok) throw new Error(`The endpoint returned an error (HTTP ${res.status}).`);
        apps = (await res.json()).applications || [];
      }
    } catch (e) {
      apps = [];
      note(e instanceof TypeError ? "Couldn't reach the endpoint. Check the URL in Settings and your connection." : e.message, true);
    } finally {
      $("[data-refresh]").disabled = false;
    }
    render();
  }

  // ---------- Rendering ----------

  function bars(list, entries, total) {
    list.replaceChildren();
    if (!entries.length) {
      list.append(el("li", { className: "empty-small", textContent: "Nothing yet." }));
      return;
    }
    for (const [label, n, custom] of entries) {
      const pct = total ? Math.round((n / total) * 100) : 0;
      const li = el("li", { className: `bar${custom ? " custom" : ""}` },
        el("span", { textContent: label, title: label }),
        el("b", { textContent: `${n} · ${pct}%` }),
        el("i"));
      li.style.setProperty("--w", `${pct}%`);
      list.append(li);
    }
  }

  function renderSummary() {
    const total = apps.length;
    $("[data-summary]").hidden = !total;
    const wants = new Map();
    const typed = new Map();
    for (const a of apps) {
      for (const w of a.wants || []) wants.set(w, (wants.get(w) || 0) + 1);
      // Typed-in options are grouped case-insensitively, shown as first written.
      const seen = new Set();
      for (const w of a.wantsOther || []) {
        const key = w.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const cur = typed.get(key) || [w.trim(), 0];
        typed.set(key, [cur[0], cur[1] + 1]);
      }
    }
    const entries = [...[...wants].map(([k, n]) => [k, n, false]), ...[...typed.values()].map(([k, n]) => [k, n, true])]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    bars($("[data-wants]"), entries, total);
    const seats = SEATS.map((s) => [s, apps.filter((a) => a.seats === s).length, false]).filter(([, n]) => n);
    bars($("[data-seats]"), seats, total);
  }

  function detail(a) {
    const dl = el("dl", { className: "detail" });
    const row = (k, v) => dl.append(el("dt", { textContent: k }), el("dd", {}, v));
    const list = (items) => (items?.length ? el("ul", {}, ...items.map((t) => el("li", { textContent: t }))) : "None");
    row("Name", a.name);
    row("Email", el("a", { href: `mailto:${a.email}`, textContent: a.email }));
    row("Company", a.company);
    row("Seats", a.seats);
    row("Wants", list(a.wants));
    row("Typed in", list(a.wantsOther));
    row("Phone", a.phone ? el("a", { href: `tel:${a.phone}`, textContent: a.phone }) : "None");
    row("Contact consent", a.contactConsent ? "Yes, by phone, text and email" : "No");
    row("Received", time(a) ? new Date(time(a)).toLocaleString() : "Unknown");
    return dl;
  }

  function render() {
    $("[data-count]").textContent = apps.length ? `(${apps.length})` : "";
    $("[data-export]").disabled = !apps.length;
    renderSummary();
    const q = $("[data-search]").value.trim().toLowerCase();
    const shown = apps.filter((a) => !q || [a.name, a.email, a.company, a.phone, ...(a.wants || []), ...(a.wantsOther || [])].join(" ").toLowerCase().includes(q));
    const rows = $("[data-rows]");
    rows.replaceChildren();
    if (!shown.length) {
      rows.append(el("p", { className: "empty", textContent: apps.length ? "No applications match." : "No applications yet." }));
      return;
    }
    shown.forEach((a, i) => {
      const id = a.id || `${time(a)}-${i}`;
      const isOpen = open.has(id);
      const panel = detail(a);
      panel.hidden = !isOpen;
      panel.id = `app-${i}`;
      const btn = el("button", { type: "button" },
        el("span", { className: "who" }, el("b", { textContent: a.name })),
        el("span", { className: "col-email muted", textContent: a.email }),
        el("span", { className: "col-company", textContent: a.company }),
        el("span", { className: "col-seats muted", textContent: a.seats }),
        el("span", { className: "col-date muted", textContent: when(time(a)) }),
        el("span", { className: "chev", textContent: "›" }));
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.setAttribute("aria-controls", panel.id);
      const item = el("div", { className: `app${isOpen ? " open" : ""}` }, btn, panel);
      btn.addEventListener("click", () => {
        const now = !open.has(id);
        if (now) open.add(id); else open.delete(id);
        item.classList.toggle("open", now);
        panel.hidden = !now;
        btn.setAttribute("aria-expanded", String(now));
      });
      rows.append(item);
    });
  }

  // ---------- CSV ----------

  function csv() {
    const cols = [
      ["Received", (a) => time(a) || ""], ["Name", (a) => a.name], ["Email", (a) => a.email], ["Company", (a) => a.company],
      ["Seats", (a) => a.seats], ["Wants", (a) => (a.wants || []).join("; ")], ["Typed in", (a) => (a.wantsOther || []).join("; ")],
      ["Phone", (a) => a.phone || ""], ["Contact consent", (a) => (a.contactConsent ? "Yes" : "No")],
    ];
    // Quote every cell; a leading = + - @ is neutralized so spreadsheets don't run it as a formula.
    const cell = (v) => `"${String(v ?? "").replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
    return [cols.map(([h]) => cell(h)).join(","), ...apps.map((a) => cols.map(([, f]) => cell(f(a))).join(","))].join("\r\n");
  }

  $("[data-export]").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob(["﻿" + csv()], { type: "text/csv" }));
    const a = el("a", { href: url, download: `legalxyz-applications-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ---------- Settings ----------

  const form = $("[data-settings]");
  const toggle = $("[data-toggle-settings]");
  const showSettings = (show) => {
    form.hidden = !show;
    toggle.setAttribute("aria-expanded", String(show));
    if (show) {
      form.endpoint.value = settings.endpoint || "";
      form.token.value = settings.token || "";
      form.endpoint.focus();
    }
  };
  toggle.addEventListener("click", () => showSettings(form.hidden));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    settings = { endpoint: form.endpoint.value.trim(), token: form.token.value.trim() };
    write(SETTINGS, settings);
    showSettings(false);
    load();
  });
  $("[data-forget]").addEventListener("click", () => {
    settings = {};
    write(SETTINGS, null);
    showSettings(false);
    load();
  });

  $("[data-refresh]").addEventListener("click", load);
  $("[data-search]").addEventListener("input", render);

  // Default the endpoint to the one the home page's form posts to.
  (async () => {
    if (!settings.endpoint) {
      try {
        const html = await (await fetch("index.html")).text();
        const endpoint = new DOMParser().parseFromString(html, "text/html").querySelector("[data-apply-form]")?.dataset.applyEndpoint;
        if (endpoint) {
          settings = { ...settings, endpoint };
          if (!settings.token) {
            note("Enter your admin token in Settings to load applications.");
            showSettings(true);
            $("[data-rows]").replaceChildren(el("p", { className: "empty", textContent: "Waiting for the admin token." }));
            return;
          }
        }
      } catch {}
    }
    load();
  })();
})();
