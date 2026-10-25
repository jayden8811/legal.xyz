// Counsel portal: what the client's lawyer sees. Shared matters are encrypted to counsel's
// own key, so only this portal can read them. Legal hold and verification status are
// account settings, not content, so they live in the (unencrypted) profile. Counsel's
// client list and firm roster stay on counsel's device.
window.LegalCounsel = (() => {
  const V = window.LegalVault;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const WEEK = 7 * 86400000;
  const REG = "legalxyz.counsel";
  const STATUS = { open: "Open", litigation: "In litigation", closed: "Closed" };

  let profile = {};
  let saveProfile = () => {};
  let matters = [];            // decrypted shared matters, each with its share key and thread
  let selectedId = null;
  let wired = false;

  const day = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const uid = () => crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12);
  const counselName = () => profile.signer || profile.lawyerName || "Counsel";

  const readReg = () => {
    try { return { clients: [], firm: [], ...JSON.parse(localStorage.getItem(REG)) }; } catch { return { clients: [], firm: [] }; }
  };
  const writeReg = (r) => {
    try { localStorage.setItem(REG, JSON.stringify(r)); } catch {}
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(text, cls, onClick) {
    const b = el("button", cls, text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  async function open(state, save) {
    profile = state;
    saveProfile = save || saveProfile;
    wire();

    let priv = await V.loadCounselKey();
    // Agreements signed before counsel keys existed, or on a browser that dropped the key:
    // set up counsel's key on this device and re-share the client's matters to it.
    if (profile.signedAt && (!priv || !profile.counselPublicKey)) {
      profile.counselPublicKey = await V.createCounselKeys();
      saveProfile();
      priv = await V.loadCounselKey();
    }
    if (profile.signedAt) await window.LegalWorkspace.syncForCounsel(profile);
    const ok = !!priv && !!profile.signedAt;
    $("[data-cp-locked]").hidden = ok;
    $("[data-cp-main]").hidden = !ok;
    $("[data-cp-name]").textContent = counselName();
    renderBar();
    if (!ok) return;

    matters = [];
    for (const box of Object.values(V.readShared())) {
      try {
        const { value, shareKey } = await V.openAsCounsel(priv, box);
        matters.push({ ...value, shareKey, thread: await V.readMatterThread(shareKey, value.id) });
      } catch {}
    }
    matters.sort((a, b) => lastAt(b) - lastAt(a));
    if (!matters.some((m) => m.id === selectedId)) selectedId = matters[0]?.id || null;
    render();
  }

  const lastAt = (m) => Math.max(m.messages.at(-1)?.at || 0, m.thread.at(-1)?.at || 0, m.sharedAt || 0);

  function render() {
    renderClients();
    renderConflicts();
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
  }

  // ---------- Clients and conflicts ----------

  function renderClients() {
    const list = $("[data-cp-clients]");
    list.replaceChildren();
    const live = el("div", "client-chip live");
    live.append(el("strong", null, profile.company || "Client"), el("span", null, profile.signedAt ? "On legal.xyz · agreement active" : "Agreement ended"));
    list.append(live);
    readReg().clients.forEach((c) => {
      const chip = el("div", "client-chip");
      chip.append(el("strong", null, c.name), el("span", null, "Conflict list only"));
      chip.append(button("Remove", "link-btn", () => {
        const r = readReg();
        r.clients = r.clients.filter((x) => x.id !== c.id);
        writeReg(r);
        render();
      }));
      list.append(chip);
    });
  }

  // Normalize company names so "Oakline Retail, LLC" matches "oakline retail".
  const norm = (s) => (s || "").toLowerCase().replace(/[.,'"]/g, "").replace(/\b(llc|inc|corp|corporation|co|ltd|lp|llp|plc|company)\b/g, "").replace(/\s+/g, " ").trim();

  function conflicts() {
    const others = readReg().clients;
    const out = [];
    matters.forEach((m) => {
      const opp = norm(m.details?.opposing);
      if (!opp) return;
      others.forEach((c) => {
        const n = norm(c.name);
        if (n && (n === opp || n.includes(opp) || opp.includes(n))) out.push({ matter: m, client: c });
      });
    });
    return out;
  }

  function renderConflicts() {
    const box = $("[data-cp-conflicts]");
    box.replaceChildren();
    const found = conflicts();
    $('[data-cp-tab="conflicts"]').textContent = found.length ? `Conflicts (${found.length})` : "Conflicts";
    const checked = matters.filter((m) => m.details?.opposing).length;
    if (!found.length) {
      box.append(el("p", "note ok-text", `No conflicts found. Checked ${checked} opposing part${checked === 1 ? "y" : "ies"} against ${readReg().clients.length + 1} client${readReg().clients.length ? "s" : ""}.`));
      return;
    }
    found.forEach(({ matter, client }) => {
      box.append(el("p", "conflict", `Possible conflict: "${matter.name}" is against ${matter.details.opposing}, and ${client.name} is on your client list.`));
    });
  }

  // ---------- Client panel ----------

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

  function openRequests(m) {
    const done = new Set(m.thread.filter((e) => e.kind === "fulfilled").map((e) => e.requestId));
    return m.thread.filter((e) => e.kind === "request" && !done.has(e.id));
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
      const pending = openRequests(m).length;
      const next = (m.deadlines || []).filter((d) => !d.done).sort((a, b) => a.due.localeCompare(b.due))[0];
      const item = el("div", "sum-item");
      item.append(el("strong", null, m.name));
      const bits = [`${recent.length} message${recent.length === 1 ? "" : "s"} this week`, `${files.length} document${files.length === 1 ? "" : "s"}`];
      if (pending) bits.push(`${pending} request${pending === 1 ? "" : "s"} open`);
      if (next) bits.push(`next deadline ${next.title}, ${next.due}`);
      if (m.details?.status && m.details.status !== "open") bits.push(STATUS[m.details.status]);
      item.append(el("p", "note", bits.join(" · ")));
      if (lastQ) item.append(el("p", "sum-quote", `Latest question: “${clip(lastQ.text, 160)}”`));
      box.append(item);
    });
  }

  // ---------- Privilege log ----------

  // One row per shared communication, in the format courts expect for a privilege log.
  function logRows() {
    const counsel = `${counselName()} (counsel)`;
    const client = (who) => `${who || "Client"} (${profile.company})`;
    const rows = [];
    matters.forEach((m) => {
      m.messages.forEach((msg) => {
        const docs = (msg.files || []).map((f) => f.name).join("; ");
        rows.push({
          at: msg.at,
          author: msg.role === "user" ? client(msg.author) : "legal.xyz assistant (agent of counsel)",
          recipients: msg.role === "user" ? `legal.xyz assistant; ${counsel}` : `${client(msg.author)}; ${counsel}`,
          matter: m.name,
          description: `Confidential ${docs ? `communication and document(s) (${docs})` : "communication"} regarding ${m.name}, made for the purpose of obtaining legal advice`,
        });
      });
      m.thread.forEach((e) => {
        const fromCounsel = e.from === "counsel";
        rows.push({
          at: e.at,
          author: fromCounsel ? counsel : client(e.author),
          recipients: fromCounsel ? client() : counsel,
          matter: m.name,
          description: fromCounsel
            ? `Confidential ${e.kind === "request" ? "request for documents" : "communication from counsel"} regarding ${m.name}, providing legal advice`
            : `Confidential ${e.kind === "fulfilled" ? `document(s) provided to counsel (${(e.files || []).join("; ")})` : e.kind === "review" ? "communication submitted to counsel for review" : "communication to counsel"} regarding ${m.name}, made for the purpose of obtaining legal advice`,
        });
      });
    });
    return rows.sort((a, b) => a.at - b.at).map((r) => ({ ...r, date: iso(r.at), basis: "Attorney-client privilege; work product" }));
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
    return ["Privileged & Confidential", COLS.map(([, l]) => esc(l)).join(","), ...logRows().map((r) => COLS.map(([k]) => esc(r[k])).join(","))].join("\r\n");
  }

  // ---------- Shared matters ----------

  function renderMatters() {
    const list = $("[data-cp-matters]");
    const thread = $("[data-cp-thread]");
    const tools = $("[data-cp-tools]");
    list.replaceChildren();
    thread.replaceChildren();
    tools.hidden = !matters.length;
    if (!matters.length) {
      const empty = el("div", "cp-empty");
      empty.append(
        el("h3", null, "Nothing shared yet"),
        el("p", "note", `When ${profile.company || "your client"} shares a matter, its conversations, documents and deadlines appear here. New matters are shared by default; clients can turn sharing on or off from the matter's header.`),
      );
      thread.append(empty);
      list.append(el("p", "note", "No shared matters."));
      return;
    }
    matters.forEach((m) => {
      const b = button("", "matter" + (m.id === selectedId ? " is-active" : ""), () => { selectedId = m.id; renderMatters(); });
      const status = m.details?.status && m.details.status !== "open" ? ` · ${STATUS[m.details.status]}` : "";
      b.append(el("span", "matter-name", m.name), el("span", "matter-meta", `${m.workspace ? m.workspace + " · " : ""}${m.messages.length} messages${status}`));
      list.append(b);
    });
    const m = matters.find((x) => x.id === selectedId);

    const facts = el("div", "matter-strip inline");
    if (m.details?.opposing) facts.append(el("span", "chip", `vs. ${m.details.opposing}`));
    if (m.details?.caseNo) facts.append(el("span", "chip", `Case ${m.details.caseNo}`));
    if (m.details?.status && m.details.status !== "open") facts.append(el("span", "chip warn", STATUS[m.details.status]));
    if (m.frozen && m.details?.status === "litigation") facts.append(el("span", "chip", `Record frozen ${day(m.frozen.at)} · ${m.frozen.hash.slice(0, 12)}`));
    (m.deadlines || []).filter((d) => !d.done).forEach((d) => facts.append(el("span", "chip", `${d.title}: ${d.due}`)));
    if (facts.children.length) thread.append(facts);

    // A hold on just this matter: the client's app won't delete or edit anything in it.
    const held = !!profile.matterHolds?.[m.id];
    const hold = el("label", "switch matter-hold");
    const box = el("input");
    box.type = "checkbox";
    box.checked = held || !!profile.legalHold;
    box.disabled = !!profile.legalHold;
    box.addEventListener("change", () => {
      profile.matterHolds ||= {};
      if (box.checked) profile.matterHolds[m.id] = Date.now();
      else delete profile.matterHolds[m.id];
      saveProfile();
      renderMatters();
    });
    hold.append(box, el("span", "switch-track"), el("span", null, profile.legalHold ? "Legal hold (whole workspace)" : held ? `Legal hold since ${day(profile.matterHolds[m.id])}` : "Legal hold on this matter"));
    thread.append(hold);

    // Fulfilled requests already appear as the client's upload message, so skip that entry.
    const items = [...m.messages.map((msg) => ({ at: msg.at, msg })), ...m.thread.filter((e) => e.kind !== "fulfilled").map((e) => ({ at: e.at, e }))].sort((a, b) => a.at - b.at);
    if (!items.length) thread.append(el("p", "note", "No messages in this matter yet."));
    const open = new Set(openRequests(m).map((r) => r.id));
    const convTitle = (id) => (m.conversations || []).find((c) => c.id === id)?.title;
    let lastConv = null;
    items.forEach(({ msg, e }) => {
      if (msg && msg.convId !== lastConv && convTitle(msg.convId)) {
        lastConv = msg.convId;
        thread.append(el("div", "conv-divider", convTitle(msg.convId)));
      }
      if (msg) {
        const wrap = el("div", `msg msg-${msg.role}`);
        if (msg.text) wrap.append(el("div", "msg-body", msg.text));
        if (msg.files?.length) {
          const files = el("div", "attachments");
          msg.files.forEach((f) => files.append(el("span", "file-chip", f.name)));
          wrap.append(files);
        }
        wrap.append(el("div", "msg-meta", `${msg.role === "user" ? msg.author || "Client" : "Assistant"} · ${when(msg.at)}${msg.editedAt ? " · edited" : ""}`));
        thread.append(wrap);
      } else {
        const fromCounsel = e.from === "counsel";
        const wrap = el("div", `msg msg-note ${fromCounsel ? "from-me" : "from-client"}`);
        const label = e.kind === "request" ? `Document request${open.has(e.id) ? " · waiting on client" : " · provided"}` : e.kind === "review" ? "Flagged by client for your review" : fromCounsel ? "Your note" : "Client";
        wrap.append(el("div", "note-label", label));
        if (e.text) wrap.append(el("div", "msg-body", e.text));
        if (e.files?.length) {
          const files = el("div", "attachments");
          e.files.forEach((name) => files.append(el("span", "file-chip", name)));
          wrap.append(files);
        }
        wrap.append(el("div", "msg-meta", `${e.author || (fromCounsel ? counselName() : "Client")} · ${when(e.at)}`));
        thread.append(wrap);
      }
    });
    thread.scrollTop = thread.scrollHeight;
  }

  async function postToSelected(kind, text) {
    const m = matters.find((x) => x.id === selectedId);
    if (!m || !text) return;
    await V.postToMatter(m.shareKey, m.id, { id: uid(), at: Date.now(), from: "counsel", kind, text, author: counselName() });
    m.thread = await V.readMatterThread(m.shareKey, m.id);
    render();
  }

  // ---------- Wiring ----------

  function selectTab(tab) {
    $$("[data-cp-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cpTab === tab)));
    $$("[data-cp-panel]").forEach((p) => { p.hidden = p.dataset.cpPanel !== tab; });
  }

  function wire() {
    if (wired) return;
    wired = true;

    $$("[data-cp-tab]").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.cpTab)));

    $("[data-cp-hold]").addEventListener("change", (e) => {
      profile.legalHold = e.target.checked;
      profile.holdChangedAt = Date.now();
      saveProfile();
      renderClient();
    });

    $("[data-cp-revoke]").addEventListener("click", () => { $("[data-cp-revoke-confirm]").hidden = false; });
    $("[data-cp-revoke-cancel]").addEventListener("click", () => { $("[data-cp-revoke-confirm]").hidden = true; });
    $("[data-cp-revoke-yes]").addEventListener("click", () => {
      delete profile.signedAt;
      profile.revokedAt = Date.now();
      saveProfile();
      $("[data-cp-revoke-confirm]").hidden = true;
      render();
    });

    $("[data-cp-agreement-pdf]").addEventListener("click", () => window.LegalPDF.agreement(profile).save("privilege-agreement.pdf"));

    $("[data-cp-note-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = e.target.elements.note;
      const kind = e.submitter?.value === "request" ? "request" : "comment";
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      await postToSelected(kind, text);
    });

    $("[data-cp-client-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = e.target.elements.client.value.trim();
      if (!name) return;
      const r = readReg();
      r.clients.push({ id: uid(), name, addedAt: Date.now() });
      writeReg(r);
      e.target.reset();
      render();
    });

    $("[data-cp-log-download]").addEventListener("click", () => {
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([csv()], { type: "text/csv" })),
        download: `privilege-log-${(profile.company || "client").replace(/\W+/g, "-").toLowerCase()}.csv`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    });

    $("[data-cp-log-pdf]").addEventListener("click", () => {
      const doc = window.LegalPDF.create({ title: `Privilege log - ${profile.company}` });
      doc.heading("Privilege log", 18).kv([
        ["Client", profile.company],
        ["Counsel", `${counselName()}, ${profile.firm}`],
        ["Prepared", new Date().toLocaleString()],
        ["Entries", String(logRows().length)],
      ]).rule();
      logRows().forEach((r, i) => {
        doc.text(`${i + 1}. ${r.date} - ${r.matter}`, { size: 10, bold: true, gap: 0 });
        doc.text(`Author: ${r.author}`, { size: 9.5, gray: true, gap: 0 });
        doc.text(`Recipients: ${r.recipients}`, { size: 9.5, gray: true, gap: 0 });
        doc.text(r.description, { size: 10, gap: 0 });
        doc.text(`Privilege asserted: ${r.basis}`, { size: 9.5, gray: true, gap: 8 });
      });
      doc.save(`privilege-log-${(profile.company || "client").replace(/\W+/g, "-").toLowerCase()}.pdf`);
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

    // The client may share, update or reply from another tab.
    addEventListener("storage", (e) => {
      if ((e.key === "legalxyz.shared" || e.key === "legalxyz.threads") && $('[data-screen="counsel"]').classList.contains("is-active")) open(profile);
    });
  }

  return { open };
})();
