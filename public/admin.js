// Applications admin: lists applications from GET /api/applications (needs the ADMIN_TOKEN
// set on the Vercel project), with search and CSV export.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const SETTINGS = "legalxyz.admin";
  const ENDPOINT = "api/applications";

  let apps = [];
  const open = new Set();

  const read = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS)) || {}; } catch { return {}; }
  };
  const write = (value) => {
    try {
      if (value == null) localStorage.removeItem(SETTINGS);
      else localStorage.setItem(SETTINGS, JSON.stringify(value));
    } catch {}
  };
  let settings = read();

  const note = (msg, error = false) => {
    const box = $("[data-note]");
    box.textContent = msg || "";
    box.classList.toggle("error", error);
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
  const host = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url || ""; }
  };

  // ---------- Loading ----------

  async function load() {
    note("");
    if (!settings.token) {
      apps = [];
      render();
      note("Enter your admin token in Settings to load applications.");
      return showSettings(true);
    }
    $("[data-refresh]").disabled = true;
    try {
      const res = await fetch(ENDPOINT, { headers: { Authorization: `Bearer ${settings.token}` }, cache: "no-store" });
      if (res.status === 401) throw new Error("The admin token was rejected. Check it in Settings.");
      if (!res.ok) throw new Error(`The server returned an error (HTTP ${res.status}).`);
      apps = (await res.json()).applications || [];
    } catch (e) {
      apps = [];
      note(e instanceof TypeError ? "Couldn't reach the server. Check your connection." : e.message, true);
    } finally {
      $("[data-refresh]").disabled = false;
    }
    render();
  }

  // ---------- Rendering ----------

  function detail(a) {
    const dl = el("dl", { className: "detail" });
    const row = (k, v) => dl.append(el("dt", { textContent: k }), el("dd", {}, v));
    row("Name", a.name);
    row("Law firm", a.firm);
    row("Email", el("a", { href: `mailto:${a.email}`, textContent: a.email }));
    row("Website", a.website ? el("a", { href: a.website, target: "_blank", rel: "noopener noreferrer", textContent: a.website }) : "None");
    row("Received", time(a) ? new Date(time(a)).toLocaleString() : "Unknown");
    return dl;
  }

  function render() {
    $("[data-count]").textContent = apps.length ? `(${apps.length})` : "";
    $("[data-export]").disabled = !apps.length;
    const q = $("[data-search]").value.trim().toLowerCase();
    const shown = apps.filter((a) => !q || [a.name, a.firm, a.email, a.website].join(" ").toLowerCase().includes(q));
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
        el("span", { className: "col-firm", textContent: a.firm }),
        el("span", { className: "col-email muted", textContent: a.email }),
        el("span", { className: "col-site muted", textContent: host(a.website) }),
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
    const cols = [["Received", (a) => time(a) || ""], ["Name", (a) => a.name], ["Law firm", (a) => a.firm], ["Email", (a) => a.email], ["Website", (a) => a.website || ""]];
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
  function showSettings(show) {
    form.hidden = !show;
    toggle.setAttribute("aria-expanded", String(show));
    if (show) {
      form.token.value = settings.token || "";
      form.token.focus();
    }
  }
  toggle.addEventListener("click", () => showSettings(form.hidden));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    settings = { token: form.token.value.trim() };
    write(settings);
    showSettings(false);
    load();
  });
  $("[data-forget]").addEventListener("click", () => {
    settings = {};
    write(null);
    load();
  });

  $("[data-refresh]").addEventListener("click", load);
  $("[data-search]").addEventListener("input", render);

  load();
})();
