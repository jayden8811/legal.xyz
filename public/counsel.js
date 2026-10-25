// Counsel portal: what the client's lawyer sees. Shared matters are encrypted to counsel's
// own key, so only this portal can read them. Legal hold and verification status are
// account settings, not content, so they live in the (unencrypted) profile.
window.LegalCounsel = (() => {
  const V = window.LegalVault;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const WEEK = 7 * 86400000;

  let profile = {};
  let saveProfile = () => {};
  let matters = [];
  let selectedId = null;
  let wired = false;

  const day = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  async function open(state, save) {
    profile = state;
    saveProfile = save || saveProfile;
    wire();

    const priv = await V.loadCounselKey();
    const ok = !!priv && !!profile.counselPublicKey;
    $("[data-cp-locked]").hidden = ok;
    $("[data-cp-main]").hidden = !ok;
    $("[data-cp-name]").textContent = profile.signer || profile.lawyerName || "Counsel";
    renderBar();
    if (!ok) return;

    matters = [];
    for (const box of Object.values(V.readShared())) {
      try { matters.push(await V.openAsCounsel(priv, box)); } catch {}
    }
    matters.sort((a, b) => lastAt(b) - lastAt(a));
    if (!matters.some((m) => m.id === selectedId)) selectedId = matters[0]?.id || null;
    render();
  }

  const lastAt = (m) => m.messages.at(-1)?.at || m.sharedAt || 0;

  function render() {
    renderClient();
    renderSummary();
    renderLog();
    renderMatters();
  }

  function renderBar() {
    const verified = profile.barStatus === "verified";
    const chip = $("[data-cp-bar]");
    chip.textContent = profile.bar ? `Bar #${profile.bar} (${profile.barState}) · ${verified ? "verified" : "verification pending"}` : "";
    chip.classList.toggle("ok", verified);
    $("[data-cp-verify]").hidden = verified || !profile.bar;
  }

  function renderClient() {
    $("[data-cp-company]").textContent = profile.company || "";
    $("[data-cp-agreement]").textContent = profile.signedAt
      ? `Privilege agreement signed ${day(profile.signedAt)}. ${matters.length} of their matters shared with you.`
      : "Agreement ended. The client's workspace is locked until new counsel signs.";
    const hold = $("[data-cp-hold]");
    hold.checked = !!profile.legalHold;
    hold.disabled = !profile.signedAt;
    $("[data-cp-hold-note]").textContent = profile.legalHold
      ? `On since ${day(profile.holdChangedAt)}. Auto-delete is paused for every matter in this workspace.`
      : "Turn on when litigation is reasonably anticipated. It pauses auto-delete for every matter, including ones not shared with you.";
    $("[data-cp-revoke-box]").hidden = !profile.signedAt;
  }

  function renderSummary() {
    const box = $("[data-cp-summary]");
    box.replaceChildren();
    if (!matters.length) {
      box.append(el("p", "note", "Nothing shared yet. Your client chooses which matters to share with you."));
      return;
    }
    const since = Date.now() - WEEK;
    matters.forEach((m) => {
      const recent = m.messages.filter((msg) => msg.at >= since);
      const lastQ = [...m.messages].reverse().find((msg) => msg.role === "user" && msg.text);
      const files = m.messages.flatMap((msg) => msg.files || []);
      const item = el("div", "sum-item");
      item.append(el("strong", null, m.name));
      item.append(el("p", "note", `${recent.length} message${recent.length === 1 ? "" : "s"} this week · ${files.length} document${files.length === 1 ? "" : "s"} · last activity ${day(lastAt(m))}`));
      if (lastQ) item.append(el("p", "sum-quote", `Latest question: “${clip(lastQ.text, 160)}”`));
      box.append(item);
    });
  }

  // One row per shared communication, in the format courts expect for a privilege log.
  function logRows() {
    const counsel = `${profile.signer || profile.lawyerName} (counsel)`;
    const rows = [];
    matters.forEach((m) => m.messages.forEach((msg) => {
      const docs = (msg.files || []).map((f) => f.name).join("; ");
      rows.push({
        date: iso(msg.at),
        author: msg.role === "user" ? `${msg.author || "Client"} (${profile.company})` : "legal.xyz assistant (agent of counsel)",
        recipients: msg.role === "user" ? `legal.xyz assistant; ${counsel}` : `${msg.author || profile.company}; ${counsel}`,
        matter: m.name,
        description: `Confidential ${docs ? "communication and document(s) (" + docs + ")" : "communication"} regarding ${m.name}, made for the purpose of obtaining legal advice`,
        basis: "Attorney-client privilege; work product",
        at: msg.at,
      });
    }));
    return rows.sort((a, b) => a.at - b.at);
  }

  const COLS = [["date", "Date"], ["author", "Author"], ["recipients", "Recipients"], ["matter", "Matter"], ["description", "Description"], ["basis", "Privilege asserted"]];

  function renderLog() {
    const table = $("[data-cp-log]");
    table.replaceChildren();
    const rows = logRows();
    const head = el("tr");
    COLS.forEach(([, label]) => head.append(el("th", null, label)));
    const thead = el("thead");
    thead.append(head);
    const tbody = el("tbody");
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "note", "No shared communications yet.");
      td.colSpan = COLS.length;
      tr.append(td);
      tbody.append(tr);
    }
    rows.forEach((r) => {
      const tr = el("tr");
      COLS.forEach(([k]) => tr.append(el("td", null, r[k])));
      tbody.append(tr);
    });
    table.append(thead, tbody);
    $("[data-cp-log-download]").disabled = $("[data-cp-log-copy]").disabled = !rows.length;
  }

  function csv() {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    return [COLS.map(([, l]) => esc(l)).join(","), ...logRows().map((r) => COLS.map(([k]) => esc(r[k])).join(","))].join("\r\n");
  }

  function renderMatters() {
    const list = $("[data-cp-matters]");
    const thread = $("[data-cp-thread]");
    list.replaceChildren();
    thread.replaceChildren();
    if (!matters.length) {
      thread.append(el("p", "note", "Shared matters will appear here."));
      return;
    }
    matters.forEach((m) => {
      const b = el("button", "matter" + (m.id === selectedId ? " is-active" : ""));
      b.type = "button";
      b.append(el("span", "matter-name", m.name), el("span", "matter-meta", `${m.messages.length} messages · shared ${day(m.sharedAt || lastAt(m))}`));
      b.addEventListener("click", () => { selectedId = m.id; renderMatters(); });
      list.append(b);
    });
    const m = matters.find((x) => x.id === selectedId);
    if (!m.messages.length) thread.append(el("p", "note", "No messages in this matter yet."));
    m.messages.forEach((msg) => {
      const wrap = el("div", `msg msg-${msg.role}`);
      if (msg.text) wrap.append(el("div", "msg-body", msg.text));
      if (msg.files?.length) {
        const files = el("div", "attachments");
        msg.files.forEach((f) => files.append(el("span", "file-chip", f.name)));
        wrap.append(files);
      }
      wrap.append(el("div", "msg-meta", `${msg.role === "user" ? msg.author || "Client" : "legal.xyz"} · ${when(msg.at)}`));
      thread.append(wrap);
    });
  }

  function wire() {
    if (wired) return;
    wired = true;

    $("[data-cp-hold]").addEventListener("change", (e) => {
      profile.legalHold = e.target.checked;
      profile.holdChangedAt = Date.now();
      saveProfile();
      renderClient();
    });

    // Real verification would check the state bar's attorney directory on the server.
    $("[data-cp-verify]").addEventListener("click", () => {
      profile.barStatus = "verified";
      saveProfile();
      renderBar();
    });

    $("[data-cp-revoke]").addEventListener("click", () => { $("[data-cp-revoke-confirm]").hidden = false; });
    $("[data-cp-revoke-cancel]").addEventListener("click", () => { $("[data-cp-revoke-confirm]").hidden = true; });
    $("[data-cp-revoke-yes]").addEventListener("click", () => {
      delete profile.signedAt;
      profile.revokedAt = Date.now();
      saveProfile();
      $("[data-cp-revoke-confirm]").hidden = true;
      renderClient();
    });

    $("[data-cp-log-download]").addEventListener("click", () => {
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([csv()], { type: "text/csv" })),
        download: `privilege-log-${(profile.company || "client").replace(/\W+/g, "-").toLowerCase()}.csv`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    });

    $("[data-cp-log-copy]").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(csv());
        btn.textContent = "Copied";
      } catch {
        getSelection().selectAllChildren($("[data-cp-log]"));
        btn.textContent = "Selected";
      }
      setTimeout(() => { btn.textContent = "Copy"; }, 1600);
    });

    // The client may share or update a matter from another tab.
    window.addEventListener("storage", (e) => {
      if (e.key === "legalxyz.shared" && $('[data-screen="counsel"]').classList.contains("is-active")) open(profile);
    });
  }

  return { open };
})();
