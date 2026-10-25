// The privileged workspace: chats and documents grouped by legal matter, encrypted on
// this device. The AI model isn't connected yet; replies come from demoReply() until the
// backend exists.
//
// Data model (all inside the encrypted vault):
//   root = { v: 2, workspaces: [ws], activeWs, org, devices, seen, seenHold, tourDone }
//   ws   = { id, name, matters, activeId, members, activity, certificates }
//   matter = { id, name, messages, details, deadlines, shared, shareKey, frozen, ... }
window.LegalWorkspace = (() => {
  const V = window.LegalVault;
  const A = window.LegalAnalytics;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const DAY = 86400000;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_FILE = 1024 * 1024; // demo storage is the browser's, so keep files small

  let profile = {};          // onboarding state, shared with app.js
  let saveProfile = () => {};
  let key = null;            // CryptoKey, never leaves the device
  let root = null;
  let data = null;           // the active workspace
  let threads = {};          // decrypted counsel <-> client entries by matter id
  let wired = false;
  let query = "";
  let showArchived = false;
  let pendingFiles = [];
  let fileReads = Promise.resolve(); // sending waits for attachments still being read
  let bizOverride = false;
  let matterFormMode = "new";
  let inviteAcknowledged = "";
  let tourStep = -1;

  const active = () => data.matters.find((m) => m.id === data.activeId) || null;
  const uid = () => crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12);
  const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const day = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const shortDay = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
  const domainOf = (email) => (email || "").split("@")[1]?.toLowerCase() || "";
  const me = () => profile.name || "You";
  const counselName = () => profile.signer || profile.lawyerName || "Counsel";
  const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const dueAt = (d) => new Date(`${d.due}T23:59:00`).getTime();
  const daysLeft = (d) => Math.ceil((dueAt(d) - Date.now()) / DAY);
  const STATUS = { open: "Open", litigation: "In litigation", closed: "Closed" };

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

  function download(blob, name) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  // ---------- Persistence ----------

  function log(text, ws = data) {
    ws.activity.unshift({ at: Date.now(), who: me(), text });
    ws.activity.length = Math.min(ws.activity.length, 500);
  }

  async function persist() {
    const ok = V.writeBox(await V.encrypt(key, root));
    await syncShared();
    return ok;
  }

  // Shared matters are re-encrypted with each matter's share key, which is wrapped to
  // counsel's public key. File contents stay with the client; counsel sees file names.
  async function syncShared() {
    if (!profile.counselPublicKey) return;
    const out = {};
    for (const ws of root.workspaces) {
      for (const m of ws.matters.filter((x) => x.shared)) {
        m.shareKey ||= V.newShareKey();
        out[m.id] = await V.sealForCounsel(profile.counselPublicKey, {
          id: m.id,
          name: m.name,
          workspace: ws.name,
          company: profile.company,
          sharedAt: m.sharedAt,
          details: m.details,
          deadlines: m.deadlines,
          frozen: m.frozen,
          messages: m.messages.map(({ role, text, at, author, files }) => ({
            role, text, at, author, files: (files || []).map((f) => ({ name: f.name, size: f.size })),
          })),
        }, m.shareKey);
      }
    }
    V.writeShared(out);
  }

  function newWorkspace(name) {
    return {
      id: uid(),
      name,
      matters: [],
      activeId: null,
      members: [{ email: (profile.email || "").toLowerCase(), name: profile.name, role: "owner", status: "active" }],
      activity: [],
      certificates: [],
    };
  }

  function seed() {
    const ws = newWorkspace(profile.company || "Main workspace");
    (profile.team || []).forEach((email) => ws.members.push({ email, role: "member", status: "invited" }));
    return { v: 2, workspaces: [ws], activeWs: ws.id };
  }

  // Fill in fields added after a vault was first created.
  function normalize(r) {
    if (!r.workspaces) {
      const ws = { ...newWorkspace(profile.company || "Main workspace"), ...r };
      delete ws.notifyCounsel;
      r = { v: 2, workspaces: [ws], activeWs: ws.id, notifyCounsel: r.notifyCounsel };
    }
    r.org ||= { residency: "us", domainOnly: false, membersExport: true, analytics: true };
    r.devices ||= [];
    r.seen ||= {};
    r.notifyCounsel ??= true;
    r.workspaces.forEach((ws) => {
      ws.members ||= newWorkspace("").members;
      ws.activity ||= [];
      ws.certificates ||= [];
      ws.matters.forEach((m) => {
        m.details ||= { status: "open", opposing: "", caseNo: "", retention: "" };
        m.deadlines ||= [];
      });
    });
    return r;
  }

  // Delete messages past each matter's auto-delete window, and record a certificate.
  // Nothing is deleted while counsel has a legal hold or a matter is in litigation.
  async function applyRetention() {
    if (profile.legalHold) return;
    for (const ws of root.workspaces) {
      for (const m of ws.matters) {
        if (m.details.status === "litigation") continue;
        const days = Number(m.details.retention || profile.retention || 90);
        const cutoff = Date.now() - days * DAY;
        const removed = m.messages.filter((msg) => msg.at < cutoff);
        if (!removed.length) continue;
        m.messages = m.messages.filter((msg) => msg.at >= cutoff);
        await certify(ws, m, removed, `Auto-delete after ${days} days`);
      }
    }
  }

  async function certify(ws, m, removed, reason) {
    const cert = {
      id: uid(),
      at: Date.now(),
      matter: m.name,
      count: removed.length,
      documents: removed.reduce((n, msg) => n + (msg.files?.length || 0), 0),
      from: removed.length ? Math.min(...removed.map((x) => x.at)) : null,
      to: removed.length ? Math.max(...removed.map((x) => x.at)) : null,
      reason,
      digest: await V.sha256(JSON.stringify(removed)),
    };
    ws.certificates.unshift(cert);
    log(`Deleted ${cert.count} message${cert.count === 1 ? "" : "s"} from "${m.name}" (${reason})`, ws);
  }

  // ---------- Devices ----------

  function deviceName() {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "unknown OS";
    return `${browser} on ${os}`;
  }

  function deviceId() {
    try {
      let id = localStorage.getItem("legalxyz.deviceId");
      if (!id) localStorage.setItem("legalxyz.deviceId", (id = uid()));
      return id;
    } catch {
      return "this-session";
    }
  }

  function registerDevice() {
    const id = deviceId();
    let d = root.devices.find((x) => x.id === id);
    if (!d) {
      d = { id, name: deviceName(), addedAt: Date.now() };
      root.devices.push(d);
      log(`Added device: ${d.name}`);
    }
    d.lastSeen = Date.now();
  }

  // ---------- Open / unlock ----------

  async function open(state, save) {
    profile = state;
    saveProfile = save || saveProfile;
    wire();
    key = await V.loadKey();
    if (!key) return showUnlock();
    await load();
  }

  async function load() {
    const box = V.readBox();
    try {
      root = normalize(box ? await V.decrypt(key, box) : seed());
    } catch {
      await V.forgetDevice();
      key = null;
      return showUnlock("The key on this device doesn't match this workspace. Enter your password.");
    }
    data = root.workspaces.find((w) => w.id === root.activeWs) || root.workspaces[0];
    if (!box) log("Workspace created");
    A.enabled = root.org.analytics;
    registerDevice();
    await applyRetention();
    await persist();
    await render();
    if (!root.tourDone) startTour();
  }

  // ---------- Counsel channel ----------

  async function loadThreads() {
    threads = {};
    for (const m of data.matters) {
      if (m.shareKey) threads[m.id] = await V.readMatterThread(m.shareKey, m.id);
    }
  }

  const post = (m, entry) => V.postToMatter(m.shareKey, m.id, { id: uid(), at: Date.now(), ...entry });

  function openRequests(m) {
    const list = threads[m.id] || [];
    const done = new Set(list.filter((e) => e.kind === "fulfilled").map((e) => e.requestId));
    return list.filter((e) => e.kind === "request" && !done.has(e.id));
  }

  // ---------- Notifications ----------

  function notifications() {
    const items = [];
    data.matters.forEach((m) => {
      (threads[m.id] || [])
        .filter((e) => e.from === "counsel" && e.at > (root.seen[m.id] || 0))
        .forEach((e) => items.push({
          at: e.at,
          matterId: m.id,
          text: e.kind === "request" ? `${counselName()} requested a document in "${m.name}": ${e.text}` : `${counselName()} commented on "${m.name}"`,
        }));
      m.deadlines
        .filter((d) => !d.done && daysLeft(d) <= 3 && daysLeft(d) >= 0 && !root.seen[`deadline:${d.id}`])
        .forEach((d) => items.push({
          at: Date.now(),
          label: `Due ${shortDay(dueAt(d))}`,
          matterId: m.id,
          deadlineId: d.id,
          text: `"${d.title}" is due ${daysLeft(d) === 0 ? "today" : `in ${daysLeft(d)} day${daysLeft(d) === 1 ? "" : "s"}`} (${m.name})`,
        }));
    });
    if (profile.holdChangedAt && profile.holdChangedAt > (root.seenHold || 0)) {
      items.push({ at: profile.holdChangedAt, text: profile.legalHold ? `${counselName()} placed a legal hold. Auto-delete is paused.` : `${counselName()} lifted the legal hold.` });
    }
    return items.sort((a, b) => b.at - a.at);
  }

  function renderBell() {
    const items = notifications();
    const unread = items.length;
    const badge = $("[data-bell-count]");
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.hidden = !unread;
    const list = $("[data-notes-list]");
    list.replaceChildren();
    if (!items.length) list.append(el("p", "note", "You're all caught up."));
    items.forEach((i) => {
      const row = button("", "note-item");
      row.append(el("span", null, i.text), el("span", "note-when", i.label || when(i.at)));
      row.addEventListener("click", () => {
        $("[data-notes]").hidden = true;
        if (i.matterId) selectMatter(i.matterId);
      });
      list.append(row);
    });
  }

  // ---------- Rendering ----------

  async function render() {
    await loadThreads();
    renderStatus();
    renderSwitcher();
    renderMatters();
    renderUpcoming();
    renderThread();
    renderBell();
  }

  function renderStatus() {
    const days = Number(profile.retention || 90);
    $("[data-ws-line1]").textContent = `Privileged · ${counselName()}`;
    $("[data-ws-line2]").textContent = profile.legalHold ? "Legal hold on" : `Auto-delete ${days >= 365 ? "1 year" : `${days} days`}`;
    $("[data-hold-banner]").hidden = !profile.legalHold;
  }

  function renderSwitcher() {
    const sel = $("[data-ws-switch]");
    sel.replaceChildren();
    root.workspaces.forEach((w) => {
      const o = el("option", null, w.name);
      o.value = w.id;
      o.selected = w.id === data.id;
      sel.append(o);
    });
    const add = el("option", null, "+ New workspace…");
    add.value = "__new";
    sel.append(add);
  }

  function matches(m) {
    if (!query) return { ok: true };
    const q = query.toLowerCase();
    const fields = [m.name, m.details.opposing, m.details.caseNo].join(" ").toLowerCase();
    if (fields.includes(q)) return { ok: true };
    const hit = m.messages.find((msg) => msg.text.toLowerCase().includes(q) || (msg.files || []).some((f) => f.name.toLowerCase().includes(q)));
    if (!hit) return { ok: false };
    const i = hit.text.toLowerCase().indexOf(q);
    const snippet = i >= 0 ? `…${hit.text.slice(Math.max(0, i - 20), i + q.length + 30)}…` : "Matching document";
    return { ok: true, snippet };
  }

  function selectMatter(id) {
    data.activeId = id;
    const m = active();
    if (m?.archived !== showArchived) showArchived = !!m?.archived;
    root.seen[id] = Date.now();
    document.body.classList.remove("side-open");
    clearComposer();
    persist();
    render();
  }

  function renderMatters() {
    const nav = $("[data-matters]");
    nav.replaceChildren();
    const archivedCount = data.matters.filter((m) => m.archived).length;
    const list = data.matters
      .filter((m) => !!m.archived === showArchived)
      .map((m) => ({ m, hit: matches(m) }))
      .filter((x) => x.hit.ok)
      .sort((a, b) => b.m.updatedAt - a.m.updatedAt);

    if (!list.length) nav.append(el("p", "matters-empty", query ? "No matches." : showArchived ? "No archived matters." : "No matters yet."));
    list.forEach(({ m, hit }) => {
      const btn = button("", "matter" + (m.id === data.activeId ? " is-active" : ""), () => selectMatter(m.id));
      const name = el("span", "matter-name", m.name);
      const unseen = (threads[m.id] || []).some((e) => e.from === "counsel" && e.at > (root.seen[m.id] || 0));
      if (unseen) name.append(el("span", "dot-new"));
      btn.append(name);
      const status = m.details.status !== "open" ? `${STATUS[m.details.status]} · ` : "";
      const meta = hit.snippet || `${status}${m.messages.length} message${m.messages.length === 1 ? "" : "s"}${m.shared ? " · shared" : ""}`;
      btn.append(el("span", "matter-meta", meta));
      nav.append(btn);
    });

    const toggle = $("[data-toggle-archived]");
    toggle.hidden = !archivedCount && !showArchived;
    toggle.textContent = showArchived ? "Back to active matters" : `Archived (${archivedCount})`;
  }

  function renderUpcoming() {
    const box = $("[data-upcoming]");
    const list = $("[data-upcoming-list]");
    list.replaceChildren();
    const items = data.matters
      .filter((m) => !m.archived)
      .flatMap((m) => m.deadlines.filter((d) => !d.done && daysLeft(d) <= 14).map((d) => ({ m, d })))
      .sort((a, b) => dueAt(a.d) - dueAt(b.d))
      .slice(0, 4);
    box.hidden = !items.length;
    items.forEach(({ m, d }) => {
      const left = daysLeft(d);
      const row = button("", "upcoming-item" + (left <= 3 ? " soon" : ""), () => selectMatter(m.id));
      row.append(el("span", "upcoming-date", left < 0 ? "Overdue" : shortDay(dueAt(d))), el("span", null, `${d.title} · ${m.name}`));
      list.append(row);
    });
  }

  function renderStrip(m) {
    const strip = $("[data-matter-strip]");
    strip.replaceChildren();
    const chips = [];
    if (m.details.status !== "open") chips.push(el("span", "chip" + (m.details.status === "litigation" ? " warn" : ""), STATUS[m.details.status]));
    if (m.frozen && m.details.status === "litigation") chips.push(el("span", "chip", `Record frozen ${shortDay(m.frozen.at)} · ${m.frozen.hash.slice(0, 12)}`));
    if (m.details.opposing) chips.push(el("span", "chip", `vs. ${m.details.opposing}`));
    if (m.details.caseNo) chips.push(el("span", "chip", `Case ${m.details.caseNo}`));
    if (m.details.retention) chips.push(el("span", "chip", `Auto-delete ${m.details.retention} days`));
    const next = m.deadlines.filter((d) => !d.done).sort((a, b) => dueAt(a) - dueAt(b))[0];
    if (next) chips.push(el("span", "chip" + (daysLeft(next) <= 3 ? " warn" : ""), `${next.title}: ${shortDay(dueAt(next))}`));
    strip.append(...chips);
    strip.hidden = !chips.length;
  }

  function renderThread() {
    const m = active();
    const thread = $("[data-thread]");
    $("[data-matter-title]").textContent = m ? m.name : data.name;
    $("[data-matter-actions]").hidden = !m;
    $("[data-composer]").hidden = !m || m.archived;
    thread.replaceChildren();

    if (!m) {
      $("[data-matter-strip]").hidden = true;
      thread.append($("#ws-empty").content.cloneNode(true));
      $("[data-empty-new]", thread).addEventListener("click", () => showMatterForm("new"));
      return;
    }

    renderStrip(m);
    $("[data-share-counsel]").checked = !!m.shared;
    $("[data-archive]").textContent = m.archived ? "Restore from archive" : "Archive";

    openRequests(m).forEach((r) => thread.append(requestCard(m, r)));

    if (m.archived) thread.append(el("p", "thread-intro", "This matter is archived. Restore it to keep chatting."));
    else if (!m.messages.length) thread.append(el("p", "thread-intro", "Ask anything about this matter, or attach a document. Keep it to legal questions so it stays within privilege."));

    // Merge AI conversation and counsel notes in time order.
    // Fulfilled requests already appear as the client's upload message, so skip that entry.
    const notes = (threads[m.id] || []).filter((e) => e.kind === "comment" || (e.kind === "request" && !openRequests(m).includes(e)));
    const items = [...m.messages.map((msg) => ({ at: msg.at, msg })), ...notes.map((e) => ({ at: e.at, e }))].sort((a, b) => a.at - b.at);
    items.forEach((i) => thread.append(i.msg ? bubble(i.msg) : noteBubble(m, i.e)));
    thread.scrollTop = thread.scrollHeight;
  }

  function fileChips(files, clickable = true) {
    const box = el("div", "attachments");
    files.forEach((f) => {
      const chip = clickable ? button("", "file-chip", () => showViewer(f)) : el("span", "file-chip");
      chip.append(el("span", "file-name", f.name));
      if (f.size) chip.append(el("span", "file-size", kb(f.size)));
      box.append(chip);
    });
    return box;
  }

  function bubble(msg) {
    const wrap = el("div", `msg msg-${msg.role}`);
    if (msg.text) wrap.append(el("div", "msg-body", msg.text));
    if (msg.files?.length) wrap.append(fileChips(msg.files));
    wrap.append(el("div", "msg-meta", `${msg.role === "user" ? msg.author || me() : "legal.xyz"} · ${when(msg.at)}`));
    return wrap;
  }

  function noteBubble(m, e) {
    const fromCounsel = e.from === "counsel";
    const wrap = el("div", `msg msg-note ${fromCounsel ? "from-counsel" : "from-client"}`);
    const label = e.kind === "request" ? "Document request" : e.kind === "fulfilled" ? "Provided to counsel" : fromCounsel ? "Counsel note" : "Reply to counsel";
    wrap.append(el("div", "note-label", label));
    if (e.text) wrap.append(el("div", "msg-body", e.text));
    if (e.files?.length) wrap.append(fileChips(e.files.map((name) => ({ name })), false));
    const meta = el("div", "msg-meta", `${e.author || (fromCounsel ? counselName() : me())} · ${when(e.at)}`);
    if (fromCounsel && e.kind === "comment") meta.append(" · ", button("Reply", "link-btn", () => replyBox(wrap, m)));
    wrap.append(meta);
    return wrap;
  }

  function replyBox(after, m) {
    if (after.nextSibling?.classList?.contains("reply-box")) return;
    const form = el("form", "reply-box");
    const input = el("input");
    input.placeholder = `Reply to ${counselName()}…`;
    input.setAttribute("aria-label", "Reply to counsel");
    const send = el("button", "btn btn-primary btn-sm", "Send");
    form.append(input, send);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      await post(m, { from: "client", kind: "comment", text: input.value.trim(), author: me() });
      log(`Replied to counsel in "${m.name}"`);
      await persist();
      render();
    });
    after.after(form);
    input.focus();
  }

  function requestCard(m, r) {
    const card = el("div", "request-card");
    card.append(el("div", "note-label", `${counselName()} requested a document · ${when(r.at)}`), el("p", null, r.text));
    const label = el("label", "btn btn-primary btn-sm upload-btn");
    label.textContent = "Upload";
    const input = el("input");
    input.type = "file";
    input.multiple = true;
    input.hidden = true;
    label.append(input);
    input.addEventListener("change", async () => {
      const files = await readFiles([...input.files]);
      if (!files.length) return;
      m.messages.push({ role: "user", text: `Provided for ${counselName()}'s request: ${r.text}`, at: Date.now(), author: me(), files });
      m.updatedAt = Date.now();
      await post(m, { from: "client", kind: "fulfilled", requestId: r.id, text: r.text, files: files.map((f) => f.name), author: me() });
      log(`Provided ${files.map((f) => f.name).join(", ")} for a counsel request in "${m.name}"`);
      A.track("document_uploaded");
      if (!(await persist())) return storageFull();
      render();
    });
    card.append(label);
    return card;
  }

  // ---------- Composer ----------

  const LEGAL = /\b(law|legal|lawyer|attorney|counsel|court|sue|suing|lawsuit|litigat\w*|claim|dispute|contract|agreement|lease|tenant|landlord|clause|breach|liab\w*|indemn\w*|warrant\w*|compl\w*|regulat\w*|statute|permit|zoning|lien|evict\w*|terminat\w*|settle\w*|damages|negligen\w*|trademark|patent|copyright|privilege|subpoena|notice|employment|discriminat\w*|harass\w*|rights?|obligat\w*|enforce\w*|arbitrat\w*|deposition|demand letter)\b/i;
  const BUSINESS = /\b(revenue|profit|margin|marketing|branding|pricing|sales|growth|kpi|forecast|budget|investor|pitch|fundrais\w*|campaign|social media|ads?|seo|hiring plan|roadmap|valuation|go-to-market|customer acquisition)\b/i;
  const looksBusiness = (text) => BUSINESS.test(text) && !LEGAL.test(text);

  const TEMPLATES = [
    ["Review a contract", "Please review the attached contract. Summarize our obligations, the other side's obligations, termination rights, and any clauses that look unusual or risky for us. Contract: [name / attach]"],
    ["Respond to a demand letter", "We received the attached demand letter from [sender] on [date]. What are they claiming, what deadlines apply, and what should we discuss with our lawyer before responding?"],
    ["Prepare for a deposition", "I'm being deposed on [date] in [matter]. Help me understand the process and list topics I should review with our lawyer beforehand."],
    ["Understand a legal notice", "We received the attached notice from [agency / party]. What does it require of us, by when, and what are the consequences of not responding?"],
    ["Employment issue", "An employee issue has come up: [describe facts]. What legal risks should we raise with our lawyer, and what should we avoid doing in the meantime?"],
  ];

  function clearComposer() {
    pendingFiles = [];
    bizOverride = false;
    $("[data-biz-warn]").hidden = true;
    $("[data-file-error]").textContent = "";
    renderPending();
  }

  function renderPending() {
    const box = $("[data-pending-files]");
    box.replaceChildren();
    pendingFiles.forEach((f, i) => {
      const chip = el("span", "file-chip");
      chip.append(el("span", "file-name", f.name), el("span", "file-size", kb(f.size)));
      const x = button("×", "file-remove", () => { pendingFiles.splice(i, 1); renderPending(); });
      x.setAttribute("aria-label", `Remove ${f.name}`);
      chip.append(x);
      box.append(chip);
    });
  }

  async function readFiles(list) {
    const err = $("[data-file-error]");
    err.textContent = "";
    const out = [];
    for (const file of list) {
      if (file.size > MAX_FILE) {
        err.textContent = `${file.name} is over 1 MB, the limit in this demo.`;
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      out.push({ id: uid(), name: file.name, type: file.type, size: file.size, data: V.toB64(bytes) });
    }
    return out;
  }

  function storageFull() {
    $("[data-file-error]").textContent = "This browser's storage is full. Remove large documents and try again.";
  }

  function demoReply(matter, msg) {
    const docs = msg.files?.length ? ` I can see ${msg.files.length === 1 ? `"${msg.files[0].name}"` : `${msg.files.length} documents`} attached.` : "";
    return `Demo reply: the AI model isn't connected yet.${docs} In production, your question about "${matter.name}" would be answered by a model under a zero-data-retention agreement, and this reply would be encrypted on your device like everything else here.`;
  }

  async function send(text) {
    const m = active();
    if (!m || (!text.trim() && !pendingFiles.length)) return;
    const msg = { role: "user", text: text.trim(), at: Date.now(), author: me(), files: pendingFiles };
    m.messages.push(msg);
    m.updatedAt = Date.now();
    if (pendingFiles.length) {
      log(`Uploaded ${pendingFiles.map((f) => f.name).join(", ")} to "${m.name}"`);
      A.track("document_uploaded");
    }
    A.track("message_sent");
    if (!(await persist())) {
      m.messages.pop();
      return storageFull();
    }
    const input = $("[data-composer] textarea");
    input.value = "";
    input.style.height = "";
    clearComposer();
    await render();

    const typing = el("div", "msg msg-assistant typing");
    const dots = el("div", "msg-body");
    dots.append(el("span"), el("span"), el("span"));
    typing.append(dots);
    $("[data-thread]").append(typing);
    $("[data-thread]").scrollTop = $("[data-thread]").scrollHeight;

    setTimeout(async () => {
      m.messages.push({ role: "assistant", text: demoReply(m, msg), at: Date.now() });
      m.updatedAt = Date.now();
      await persist();
      if (active() === m) render();
    }, 900);
  }

  // ---------- Matters ----------

  async function saveMatter(name) {
    if (matterFormMode === "rename") {
      const m = active();
      log(`Renamed "${m.name}" to "${name}"`);
      m.name = name;
      m.updatedAt = Date.now();
    } else if (matterFormMode === "workspace") {
      const ws = newWorkspace(name);
      root.workspaces.push(ws);
      root.activeWs = ws.id;
      data = ws;
      log("Workspace created");
      A.track("workspace_created");
    } else {
      const m = {
        id: uid(), name, shared: false, archived: false, access: null, createdAt: Date.now(), updatedAt: Date.now(),
        messages: [], details: { status: "open", opposing: "", caseNo: "", retention: "" }, deadlines: [],
      };
      data.matters.push(m);
      data.activeId = m.id;
      showArchived = false;
      log(`Created matter "${name}"`);
      A.track("matter_created");
    }
    await persist();
    render();
  }

  function deleteBlocked(m) {
    if (profile.legalHold) return "Your lawyer has placed a legal hold, so matters can't be deleted until it's lifted.";
    if (m.details.status === "litigation") return "This matter is in litigation, so its record is locked. Change its status first if the case has ended.";
    return "";
  }

  async function deleteMatter() {
    const m = active();
    if (deleteBlocked(m)) return;
    await certify(data, m, m.messages, "Matter deleted by owner");
    data.matters = data.matters.filter((x) => x.id !== m.id);
    data.activeId = data.matters.find((x) => !x.archived)?.id || null;
    V.dropMatterThread(m.id);
    await persist();
    render();
  }

  // ---------- Overlays ----------

  function overlay(name, show) {
    const o = $(`[data-overlay="${name}"]`);
    o.hidden = !show;
    if (show) o.querySelector("input:not([type=checkbox]):not([type=file]), select, textarea, button")?.focus();
  }

  function showMatterForm(mode) {
    matterFormMode = mode;
    const form = $("[data-new-matter-form]");
    form.reset();
    $("[data-error]", form).textContent = "";
    const copy = {
      new: ["New matter", "Create matter", "Name the legal issue. Your lawyer sees this name in summaries of matters you share.", "Main St. lease dispute"],
      rename: ["Rename matter", "Save name", "Your lawyer sees this name in summaries of matters you share.", ""],
      workspace: ["New workspace", "Create workspace", "Use separate workspaces for subsidiaries or projects. Each has its own matters, team and activity log.", "Acme Construction LLC"],
    }[mode];
    $("[data-matter-form-title]").textContent = copy[0];
    $("[data-matter-form-submit]").textContent = copy[1];
    $("[data-matter-form-sub]").textContent = copy[2];
    $("[data-matter-form-label]").textContent = mode === "workspace" ? "Workspace name" : "Matter name";
    form.elements.matter.placeholder = copy[3];
    if (mode === "rename") form.elements.matter.value = active().name;
    overlay("new", true);
  }

  function showAccess() {
    const m = active();
    const list = $("[data-access-list]");
    list.replaceChildren();
    data.members.forEach((p) => {
      const row = el("label", "check");
      const box = el("input");
      box.type = "checkbox";
      box.value = p.email;
      box.checked = p.role === "owner" || !m.access || m.access.includes(p.email);
      box.disabled = p.role === "owner";
      row.append(box, el("span", null, `${p.name || p.email} · ${p.role}${p.status === "invited" ? " (invited)" : ""}`));
      list.append(row);
    });
    overlay("access", true);
  }

  function showDetails() {
    const m = active();
    const f = $("[data-details-form]");
    f.elements.opposing.value = m.details.opposing || "";
    f.elements.caseNo.value = m.details.caseNo || "";
    f.elements.status.value = m.details.status;
    f.elements.retention.value = m.details.retention || "";
    $("[data-details-hint]").textContent = m.frozen
      ? `Record frozen ${day(m.frozen.at)} with ${m.frozen.count} messages. Fingerprint ${m.frozen.hash.slice(0, 16)}…`
      : "Setting the status to In litigation locks this matter's record and pauses its auto-delete.";
    renderDeadlines();
    overlay("details", true);
  }

  function renderDeadlines() {
    const m = active();
    const list = $("[data-deadlines]");
    list.replaceChildren();
    if (!m.deadlines.length) list.append(el("p", "note", "No deadlines yet."));
    m.deadlines.sort((a, b) => dueAt(a) - dueAt(b)).forEach((d) => {
      const row = el("div", "deadline-row" + (d.done ? " done" : ""));
      const check = el("input");
      check.type = "checkbox";
      check.checked = !!d.done;
      check.setAttribute("aria-label", `Mark ${d.title} done`);
      check.addEventListener("change", async () => {
        d.done = check.checked;
        log(`${d.done ? "Completed" : "Reopened"} deadline "${d.title}" in "${m.name}"`);
        await persist();
        renderDeadlines();
        render();
      });
      const left = daysLeft(d);
      const tag = d.done ? "Done" : left < 0 ? "Overdue" : left === 0 ? "Today" : `${left} day${left === 1 ? "" : "s"}`;
      row.append(check, el("span", "deadline-title", d.title), el("span", "deadline-due", `${shortDay(dueAt(d))} · ${tag}`));
      row.append(button("Remove", "link-btn", async () => {
        m.deadlines = m.deadlines.filter((x) => x !== d);
        await persist();
        renderDeadlines();
        render();
      }));
      list.append(row);
    });
  }

  function showViewer(f) {
    const body = $("[data-viewer-body]");
    body.replaceChildren();
    $("[data-viewer-title]").textContent = f.name;
    const viewer = $("[data-overlay=viewer]");
    if (!f.data) {
      body.append(el("p", "note", "Counsel sees the file name only. The document itself stays on the client's device."));
      $("[data-viewer-download]").hidden = true;
      viewer.hidden = false;
      return;
    }
    $("[data-viewer-download]").hidden = false;
    const blob = new Blob([V.fromB64(f.data)], { type: f.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    if ((f.type || "").startsWith("image/")) {
      const img = el("img", "viewer-img");
      img.src = url;
      img.alt = f.name;
      body.append(img);
    } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      const frame = el("iframe", "viewer-frame");
      frame.src = url;
      frame.title = f.name;
      body.append(frame);
    } else if ((f.type || "").startsWith("text/") || /\.(txt|md|csv|json)$/i.test(f.name)) {
      blob.text().then((t) => body.append(el("pre", "viewer-text", t.slice(0, 200000))));
    } else {
      body.append(el("p", "note", "No preview for this file type. Download it to open it."));
    }
    $("[data-viewer-download]").onclick = () => download(blob, f.name);
    viewer.hidden = false;
    viewer.querySelector("[data-close]").focus();
  }

  function showUnlock(msg = "") {
    const err = $("[data-unlock-error]");
    err.textContent = msg;
    // Workspaces made before password-protected keys can't be unlocked by password.
    const legacy = !V.hasRing();
    if (legacy) err.textContent = "This workspace was set up with an older version that didn't save a recoverable key. Start over to continue.";
    $("[data-unlock-form] input").disabled = legacy;
    $("[data-unlock-submit]").disabled = legacy;
    overlay("unlock", true);
  }

  // What legal.xyz's servers would hold: the encrypted data and the locked keyring.
  function showCipher() {
    const box = V.readBox() || {};
    const ring = V.readRing() || {};
    const cut = (v) => (v && v.length > 300 ? v.slice(0, 300) + "…" : v);
    const shown = {
      workspace: { ...box, ct: cut(box.ct) },
      keyring: {
        byPassword: ring.byPassword && { ...ring.byPassword, ct: cut(ring.byPassword.ct) },
        byRecovery: ring.byRecovery && { ...ring.byRecovery, ct: cut(ring.byRecovery.ct) },
      },
    };
    $("[data-cipher-text]").textContent = JSON.stringify(shown, null, 2);
    overlay("cipher", true);
  }

  // ---------- Exports ----------

  function matterPdf(m) {
    const doc = window.LegalPDF.create({ title: m.name });
    doc.heading(m.name, 18).kv([
      ["Company", profile.company],
      ["Workspace", data.name],
      ["Directed by", `${counselName()}, ${profile.firm}`],
      ["Opposing party", m.details.opposing || "-"],
      ["Case number", m.details.caseNo || "-"],
      ["Status", STATUS[m.details.status]],
      ["Exported", `${new Date().toLocaleString()} by ${me()}`],
    ]).rule();
    const notes = threads[m.id] || [];
    const items = [...m.messages.map((msg) => ({ at: msg.at, msg })), ...notes.map((e) => ({ at: e.at, e }))].sort((a, b) => a.at - b.at);
    items.forEach(({ msg, e }) => {
      if (msg) {
        doc.text(`${msg.role === "user" ? msg.author || me() : "legal.xyz assistant (agent of counsel)"} - ${new Date(msg.at).toLocaleString()}`, { size: 9, bold: true, gray: true, gap: 0 });
        if (msg.text) doc.text(msg.text, { size: 10.5 });
        if (msg.files?.length) doc.text(`Attached: ${msg.files.map((f) => f.name).join(", ")}`, { size: 9, gray: true });
      } else {
        doc.text(`${e.author || (e.from === "counsel" ? counselName() : me())} (${e.from === "counsel" ? "counsel" : "client"}) - ${new Date(e.at).toLocaleString()}`, { size: 9, bold: true, gray: true, gap: 0 });
        doc.text(`${e.kind === "request" ? "Document request: " : e.kind === "fulfilled" ? "Provided: " : ""}${e.text || ""}`, { size: 10.5 });
      }
      doc.space(4);
    });
    if (!items.length) doc.text("No messages.", { gray: true });
    return doc;
  }

  function certificatePdf(c) {
    const doc = window.LegalPDF.create({ title: "Certificate of deletion" });
    doc.heading("Certificate of deletion", 18)
      .text("This certificate records that the communications described below were permanently deleted from a legal.xyz workspace. Deleted content can't be recovered by the customer or by legal.xyz.", { gray: true })
      .rule()
      .kv([
        ["Certificate ID", c.id],
        ["Company", profile.company],
        ["Workspace", data.name],
        ["Matter", c.matter],
        ["Deleted", new Date(c.at).toLocaleString()],
        ["Reason", c.reason],
        ["Messages deleted", String(c.count)],
        ["Documents deleted", String(c.documents || 0)],
        ["Date range", c.from ? `${new Date(c.from).toLocaleString()} to ${new Date(c.to).toLocaleString()}` : "-"],
        ["SHA-256 of deleted records", c.digest],
        ["Legal hold at deletion", "None"],
      ]);
    return doc;
  }

  function auditCsv() {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = data.activity.map((a) => [new Date(a.at).toISOString(), a.who, a.text].map(esc).join(","));
    return ["Privileged & Confidential", `"Timestamp","User","Event"`, ...rows].join("\r\n");
  }

  function auditPdf() {
    const doc = window.LegalPDF.create({ title: `Audit log - ${data.name}` });
    doc.heading(`Audit log: ${data.name}`, 16).text(`${profile.company} · exported ${new Date().toLocaleString()}`, { gray: true }).rule();
    data.activity.forEach((a) => doc.text(`${new Date(a.at).toLocaleString()}  ·  ${a.who}  ·  ${a.text}`, { size: 9.5, gap: 2 }));
    return doc;
  }

  // ---------- Settings ----------

  function openSettings(tab = "general") {
    selectTab(tab);
    overlay("settings", true);
  }

  function selectTab(tab) {
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $$("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    ({ general: renderGeneral, security: renderSecurity, team: renderTeam, org: renderOrg, records: renderRecords }[tab] || (() => {}))();
  }

  function renderGeneral() {
    $("[data-set-retention]").value = profile.retention || "90";
    $("[data-set-retention]").disabled = !!profile.legalHold;
    $("[data-set-hold]").textContent = profile.legalHold
      ? "Legal hold is on, so auto-delete is paused. Only your lawyer can lift it."
      : "Your lawyer can place a legal hold, which pauses auto-delete for every matter. You can also set a different period per matter.";
    $("[data-set-counsel]").textContent = `${counselName()}, ${profile.firm} · Bar #${profile.bar} (${profile.barState})`;
    $("[data-set-signed]").textContent = profile.signedAt ? day(profile.signedAt) : "";
    $("[data-set-bar]").textContent = profile.barStatus === "verified" ? "Verified" : "Pending review against state bar records";
    $("[data-notify-counsel]").checked = root.notifyCounsel !== false;
  }

  function renderSecurity() {
    $("[data-set-fp]").textContent = V.readRing()?.fingerprint || profile.keyFingerprint || "";
    const list = $("[data-devices]");
    list.replaceChildren();
    const current = deviceId();
    root.devices.forEach((d) => {
      const row = el("div", "team-row");
      const who = el("div", "team-who");
      who.append(el("strong", null, d.name + (d.id === current ? " · this device" : "")), el("span", null, `Added ${day(d.addedAt)} · last active ${when(d.lastSeen)}`));
      const btn = d.id === current
        ? button("Forget", "btn btn-ghost btn-sm", forgetDevice)
        : button("Remove", "btn btn-ghost btn-sm", async () => {
          root.devices = root.devices.filter((x) => x !== d);
          log(`Removed device: ${d.name}`);
          await persist();
          renderSecurity();
        });
      row.append(who, btn);
      list.append(row);
    });
  }

  async function forgetDevice() {
    root.devices = root.devices.filter((x) => x.id !== deviceId());
    log(`Forgot device: ${deviceName()}`);
    await persist();
    await V.forgetDevice();
    key = null;
    overlay("settings", false);
    showUnlock("This device no longer has your key. Enter your password to unlock again.");
  }

  function renderTeam() {
    const list = $("[data-team-list]");
    list.replaceChildren();
    data.members.forEach((p, i) => {
      const row = el("div", "team-row");
      const who = el("div", "team-who");
      who.append(el("strong", null, p.name || p.email), el("span", null, p.name ? p.email : p.status === "invited" ? "Invite sent" : ""));
      const role = el("select");
      role.setAttribute("aria-label", `Role for ${p.email}`);
      ["owner", "member", "viewer"].forEach((r) => {
        const o = el("option", null, r[0].toUpperCase() + r.slice(1));
        o.value = r;
        o.selected = p.role === r;
        role.append(o);
      });
      const self = p.email === (profile.email || "").toLowerCase();
      role.disabled = self;
      role.addEventListener("change", async () => {
        p.role = role.value;
        log(`Changed ${p.email} to ${p.role}`);
        await persist();
      });
      const remove = button("Remove", "btn btn-ghost btn-sm", async () => {
        data.members.splice(i, 1);
        data.matters.forEach((m) => { if (m.access) m.access = m.access.filter((e) => e !== p.email); });
        log(`Removed ${p.email}`);
        await persist();
        renderTeam();
      });
      remove.disabled = self;
      row.append(who, role, remove);
      list.append(row);
    });
    $("[data-domain-rule]").textContent = root.org.domainOnly
      ? `Your organization only allows invites to @${domainOf(profile.email)} addresses.`
      : "Owners manage settings and see every matter. Members can chat in matters they're given. Viewers can read but not send.";
  }

  function renderOrg() {
    const f = $("[data-org-form]");
    f.elements.residency.value = root.org.residency;
    f.elements.domainOnly.checked = root.org.domainOnly;
    f.elements.membersExport.checked = root.org.membersExport;
    f.elements.analytics.checked = root.org.analytics;
    $("[data-domain]").textContent = `@${domainOf(profile.email)}`;

    const list = $("[data-workspaces]");
    list.replaceChildren();
    root.workspaces.forEach((w) => {
      const row = el("div", "team-row");
      const who = el("div", "team-who");
      who.append(el("strong", null, w.name + (w.id === data.id ? " · current" : "")), el("span", null, `${w.matters.length} matters · ${w.members.length} people`));
      row.append(who, button(w.id === data.id ? "Open" : "Switch", "btn btn-ghost btn-sm", () => { switchWorkspace(w.id); overlay("settings", false); }));
      list.append(row);
    });

    const all = root.workspaces.flatMap((w) => w.matters);
    const msgs = all.reduce((n, m) => n + m.messages.length, 0);
    const docs = all.reduce((n, m) => n + m.messages.reduce((k, x) => k + (x.files?.length || 0), 0), 0);
    const bytes = (V.readBox()?.ct || "").length * 0.75;
    const stats = [["People", data.members.length], ["Matters", all.length], ["Messages", msgs], ["Documents", docs], ["Encrypted storage", kb(bytes)]];
    const grid = $("[data-usage]");
    grid.replaceChildren();
    stats.forEach(([k, v]) => {
      const cell = el("div", "stat");
      cell.append(el("span", "stat-value", String(v)), el("span", "stat-label", k));
      grid.append(cell);
    });

    const counts = A.counts();
    $("[data-analytics-list]").textContent = Object.keys(counts).length
      ? Object.entries(counts).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")
      : "No events recorded yet.";
  }

  function renderActivity() {
    const list = $("[data-activity]");
    list.replaceChildren();
    if (!data.activity.length) list.append(el("li", null, "No activity yet."));
    data.activity.forEach((a) => {
      const li = el("li");
      li.append(el("span", "activity-when", when(a.at)), el("span", null, `${a.who}: ${a.text}`));
      list.append(li);
    });
  }

  function renderRecords() {
    const list = $("[data-certs]");
    list.replaceChildren();
    if (!data.certificates.length) list.append(el("p", "note", "No deletions yet."));
    data.certificates.forEach((c) => {
      const row = el("div", "team-row");
      const who = el("div", "team-who");
      who.append(el("strong", null, `${c.matter} · ${c.count} message${c.count === 1 ? "" : "s"}`), el("span", null, `${when(c.at)} · ${c.reason}`));
      row.append(who, button("Download PDF", "btn btn-ghost btn-sm", () => certificatePdf(c).save(`deletion-certificate-${c.id}.pdf`)));
      list.append(row);
    });
    renderActivity();
  }

  function switchWorkspace(id) {
    root.activeWs = id;
    data = root.workspaces.find((w) => w.id === id);
    query = "";
    $("[data-search]").value = "";
    showArchived = false;
    clearComposer();
    persist();
    render();
  }

  function formError(form, msg, ok = false) {
    const out = $("[data-error]", form);
    out.textContent = msg;
    out.classList.toggle("ok", ok);
  }

  // ---------- Product tour ----------

  const TOUR = [
    ["[data-new-matter]", "Create one matter for each legal issue. Keeping issues separate limits what's in scope if records are ever requested."],
    ["[data-search]", "Search across matter names, parties, case numbers and every chat."],
    ["[data-bell]", "Your lawyer's comments, document requests, legal holds and upcoming deadlines show up here."],
    ["[data-open-settings]", "Your lawyer, auto-delete, team, devices and records are all in settings."],
  ];

  function startTour() {
    tourStep = 0;
    showTourStep();
  }

  function showTourStep() {
    const card = $("[data-tour]");
    if (tourStep < 0 || tourStep >= TOUR.length) {
      card.hidden = true;
      return;
    }
    const [sel, text] = TOUR[tourStep];
    $("[data-tour-text]").textContent = text;
    $("[data-tour-count]").textContent = `${tourStep + 1} of ${TOUR.length}`;
    $("[data-tour-next]").textContent = tourStep === TOUR.length - 1 ? "Done" : "Next";
    card.hidden = false;
    const target = $(sel);
    const r = target.getBoundingClientRect();
    const visible = r.width > 0 && r.left >= 0 && r.right <= innerWidth;
    if (visible) {
      card.style.top = `${Math.min(innerHeight - card.offsetHeight - 16, Math.max(16, r.top))}px`;
      card.style.left = `${Math.min(innerWidth - card.offsetWidth - 16, r.right + 14)}px`;
      card.classList.remove("centered");
    } else {
      card.classList.add("centered");
      card.style.top = card.style.left = "";
    }
    $$(".tour-target").forEach((n) => n.classList.remove("tour-target"));
    if (visible) target.classList.add("tour-target");
  }

  async function endTour() {
    tourStep = -1;
    showTourStep();
    $$(".tour-target").forEach((n) => n.classList.remove("tour-target"));
    root.tourDone = true;
    A.track("tour_completed");
    await persist();
  }

  // ---------- Wiring ----------

  function wire() {
    if (wired) return;
    wired = true;

    $("[data-new-matter]").addEventListener("click", () => showMatterForm("new"));
    $("[data-toggle-side]").addEventListener("click", () => document.body.classList.toggle("side-open"));
    $("[data-search]").addEventListener("input", (e) => { query = e.target.value.trim(); renderMatters(); });
    $("[data-toggle-archived]").addEventListener("click", () => { showArchived = !showArchived; renderMatters(); });
    $("[data-open-settings]").addEventListener("click", () => openSettings());
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => { b.closest("[data-overlay]").hidden = true; }));
    $$("[data-overlay]").forEach((o) => o.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && o.dataset.overlay !== "unlock") o.hidden = true;
    }));

    $("[data-ws-switch]").addEventListener("change", (e) => {
      if (e.target.value === "__new") {
        e.target.value = data.id;
        showMatterForm("workspace");
      } else {
        switchWorkspace(e.target.value);
      }
    });

    // Notifications
    const notes = $("[data-notes]");
    $("[data-bell]").addEventListener("click", (e) => {
      e.stopPropagation();
      notes.hidden = !notes.hidden;
    });
    notes.addEventListener("click", (e) => e.stopPropagation());
    $("[data-notes-read]").addEventListener("click", async () => {
      notifications().forEach((i) => { if (i.deadlineId) root.seen[`deadline:${i.deadlineId}`] = true; });
      data.matters.forEach((m) => { root.seen[m.id] = Date.now(); });
      root.seenHold = Date.now();
      await persist();
      render();
    });

    // Menus close on any outside click.
    const menus = [[$("[data-menu]"), $("[data-menu-toggle]")], [$("[data-templates]"), $("[data-templates-toggle]")]];
    const closeMenus = () => menus.forEach(([m, b]) => { m.hidden = true; b.setAttribute("aria-expanded", "false"); });
    menus.forEach(([m, b]) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const show = m.hidden;
      closeMenus();
      m.hidden = !show;
      b.setAttribute("aria-expanded", String(show));
    }));
    document.addEventListener("click", () => { closeMenus(); notes.hidden = true; });

    $("[data-details]").addEventListener("click", () => { closeMenus(); showDetails(); });
    $("[data-rename]").addEventListener("click", () => { closeMenus(); showMatterForm("rename"); });
    $("[data-access]").addEventListener("click", () => { closeMenus(); showAccess(); });
    $("[data-export]").addEventListener("click", () => {
      closeMenus();
      $("[data-export-form]").reset();
      formError($("[data-export-form]"), "");
      overlay("export", true);
    });
    $("[data-archive]").addEventListener("click", async () => {
      closeMenus();
      const m = active();
      m.archived = !m.archived;
      log(`${m.archived ? "Archived" : "Restored"} "${m.name}"`);
      showArchived = m.archived;
      await persist();
      render();
    });
    $("[data-delete]").addEventListener("click", () => {
      closeMenus();
      const blocked = deleteBlocked(active());
      $("[data-delete-text]").textContent = blocked || `This permanently deletes "${active().name}", its chats and documents. A certificate of deletion will be kept in Settings › Records.`;
      $("[data-delete-yes]").hidden = !!blocked;
      overlay("delete", true);
    });
    $("[data-delete-yes]").addEventListener("click", async () => {
      overlay("delete", false);
      await deleteMatter();
    });

    // Templates
    const tplMenu = $("[data-templates]");
    TEMPLATES.forEach(([title, text]) => tplMenu.append(button(title, null, () => {
      const input = $("[data-composer] textarea");
      input.value = text;
      input.dispatchEvent(new Event("input"));
      input.focus();
      input.setSelectionRange(text.indexOf("["), text.indexOf("]") + 1);
      A.track("template_used");
    })));

    $("[data-new-matter-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = e.target.elements.matter.value.trim();
      if (!name) return formError(e.target, matterFormMode === "workspace" ? "Give the workspace a name." : 'Give the matter a name, like "Main St. lease dispute".');
      overlay("new", false);
      await saveMatter(name);
    });

    $("[data-access-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = active();
      const boxes = $$("[data-access-list] input", e.target);
      const chosen = boxes.filter((b) => b.checked).map((b) => b.value);
      m.access = chosen.length === boxes.length ? null : chosen;
      log(`Updated who can see "${m.name}"`);
      overlay("access", false);
      await persist();
    });

    // Matter details, status and deadlines
    $("[data-details-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = active();
      const f = e.target.elements;
      const was = m.details.status;
      m.details = { opposing: f.opposing.value.trim(), caseNo: f.caseNo.value.trim(), status: f.status.value, retention: f.retention.value };
      if (m.details.status === "litigation" && was !== "litigation") {
        m.frozen = { at: Date.now(), count: m.messages.length, hash: await V.sha256(JSON.stringify(m.messages)) };
        log(`Marked "${m.name}" as in litigation and froze its record (${m.frozen.hash.slice(0, 12)})`);
      } else if (was !== m.details.status) {
        log(`Changed "${m.name}" status to ${STATUS[m.details.status]}`);
      } else {
        log(`Updated details for "${m.name}"`);
      }
      overlay("details", false);
      await persist();
      render();
    });

    $("[data-deadline-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      if (!f.title.value.trim() || !f.due.value) return;
      const m = active();
      m.deadlines.push({ id: uid(), title: f.title.value.trim(), due: f.due.value, done: false });
      log(`Added deadline "${f.title.value.trim()}" (${f.due.value}) to "${m.name}"`);
      e.target.reset();
      await persist();
      renderDeadlines();
      render();
    });

    // Export
    $("[data-export-pdf]").addEventListener("click", () => {
      const m = active();
      matterPdf(m).save(`${m.name.replace(/\W+/g, "-").toLowerCase()}-privileged.pdf`);
      log(`Exported "${m.name}" as PDF`);
      A.track("export_pdf");
      persist();
    });
    $("[data-export-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pass = e.target.elements.passphrase.value;
      if (pass.length < 12) return formError(e.target, "Use a passphrase of at least 12 characters.");
      const m = active();
      formError(e.target, "Encrypting…", true);
      const file = await V.exportFile(pass, { exportedAt: Date.now(), company: profile.company, workspace: data.name, matter: m, counselNotes: threads[m.id] || [] });
      download(new Blob([file], { type: "application/json" }), `${m.name.replace(/\W+/g, "-").toLowerCase()}.lxz`);
      formError(e.target, "Encrypted file created. Share the passphrase separately.", true);
      log(`Exported "${m.name}" as an encrypted file`);
      A.track("export_encrypted");
      await persist();
    });

    $("[data-share-counsel]").addEventListener("change", async (e) => {
      const m = active();
      m.shared = e.target.checked;
      if (m.shared) {
        m.sharedAt = Date.now();
        A.track("shared_with_counsel");
      }
      log(`${m.shared ? "Shared" : "Stopped sharing"} "${m.name}" with counsel`);
      await persist();
      render();
    });

    // Composer
    const composer = $("[data-composer]");
    const input = $("textarea", composer);
    composer.addEventListener("submit", async (e) => {
      e.preventDefault();
      await fileReads;
      if (!bizOverride && looksBusiness(input.value)) {
        $("[data-biz-warn]").hidden = false;
        return;
      }
      bizOverride = false;
      $("[data-biz-warn]").hidden = true;
      send(input.value);
    });
    $("[data-biz-send]").addEventListener("click", () => { bizOverride = true; composer.requestSubmit(); });
    $("[data-biz-edit]").addEventListener("click", () => { $("[data-biz-warn]").hidden = true; input.focus(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        composer.requestSubmit();
      }
    });
    input.addEventListener("input", () => {
      $("[data-biz-warn]").hidden = true;
      input.style.height = "";
      input.style.height = Math.min(input.scrollHeight, 180) + "px";
    });
    $("[data-file]").addEventListener("change", (e) => {
      const files = [...e.target.files];
      e.target.value = "";
      fileReads = fileReads.then(async () => {
        pendingFiles.push(...(await readFiles(files)));
        renderPending();
      });
    });

    // Unlock
    $("[data-unlock-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const secret = e.target.elements.secret.value;
      const err = $("[data-unlock-error]");
      if (!secret) return (err.textContent = "Enter your password or recovery code.");
      $("[data-unlock-submit]").textContent = "Unlocking…";
      key = await V.unlock(secret);
      $("[data-unlock-submit]").textContent = "Unlock";
      if (!key) return (err.textContent = "That password or recovery code didn't work.");
      e.target.reset();
      overlay("unlock", false);
      await load();
    });

    // Without the password or recovery code the data is unreadable by design, so the only way forward is a fresh setup.
    $("[data-start-over]").addEventListener("click", async () => {
      await V.clear();
      try { localStorage.removeItem("legalxyz.onboarding"); } catch {}
      location.hash = "";
      location.reload();
    });

    // Settings: general
    $("[data-set-retention]").addEventListener("change", async (e) => {
      profile.retention = e.target.value;
      saveProfile();
      log(`Changed default auto-delete to ${e.target.selectedOptions[0].textContent}`);
      await applyRetention();
      await persist();
      render();
    });
    $("[data-agreement-pdf]").addEventListener("click", () => window.LegalPDF.agreement(profile).save("privilege-agreement.pdf"));

    // Settings: security
    $("[data-pw-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { current, next } = e.target.elements;
      if (next.value.length < 12) return formError(e.target, "The new password must be at least 12 characters.");
      formError(e.target, "Checking…", true);
      if (!(await V.changePassword(current.value, next.value))) return formError(e.target, "Your current password is incorrect.");
      e.target.reset();
      log("Changed password");
      await persist();
      formError(e.target, "Password changed.", true);
    });

    $("[data-recovery-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      formError(e.target, "Checking…", true);
      const code = await V.newRecovery(e.target.elements.password.value);
      if (!code) return formError(e.target, "That password is incorrect.");
      e.target.reset();
      formError(e.target, "");
      const out = $("[data-new-recovery]");
      out.textContent = code;
      out.hidden = false;
      log("Created a new recovery code");
      await persist();
    });

    $("[data-view-cipher]").addEventListener("click", showCipher);

    // Settings: team
    const invite = $("[data-invite-form]");
    invite.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = invite.elements.email.value.trim().toLowerCase();
      const role = invite.elements.role.value;
      if (!EMAIL.test(email)) return formError(invite, "Enter a valid email address.");
      if (data.members.some((p) => p.email === email)) return formError(invite, "That person is already on the team.");
      const own = domainOf(profile.email);
      if (domainOf(email) !== own) {
        if (root.org.domainOnly) return formError(invite, `Your organization only allows invites to @${own}. An owner can change this in Organization.`);
        if (inviteAcknowledged !== email) {
          inviteAcknowledged = email;
          $("[data-invite-submit]").textContent = "Invite anyway";
          return formError(invite, `${email} is outside @${own}. Inviting outsiders can waive privilege.`);
        }
      }
      data.members.push({ email, role, status: "invited" });
      log(`Invited ${email} as ${role}`);
      invite.reset();
      inviteAcknowledged = "";
      $("[data-invite-submit]").textContent = "Send invite";
      formError(invite, "");
      await persist();
      renderTeam();
    });
    invite.elements.email.addEventListener("input", () => {
      inviteAcknowledged = "";
      $("[data-invite-submit]").textContent = "Send invite";
      formError(invite, "");
    });

    // Settings: organization
    $("[data-org-form]").addEventListener("change", async (e) => {
      const f = e.currentTarget.elements;
      root.org = { residency: f.residency.value, domainOnly: f.domainOnly.checked, membersExport: f.membersExport.checked, analytics: f.analytics.checked };
      A.enabled = root.org.analytics;
      const label = e.target.closest("label")?.textContent.trim().split("\n")[0] || e.target.name;
      log(`Changed organization setting: ${label}`);
      await persist();
      renderOrg();
    });
    $("[data-new-workspace]").addEventListener("click", () => { overlay("settings", false); showMatterForm("workspace"); });
    $("[data-audit-csv]").addEventListener("click", () => download(new Blob([auditCsv()], { type: "text/csv" }), `audit-log-${data.name.replace(/\W+/g, "-").toLowerCase()}.csv`));
    $("[data-audit-pdf]").addEventListener("click", () => auditPdf().save(`audit-log-${data.name.replace(/\W+/g, "-").toLowerCase()}.pdf`));

    // Settings: legal requests
    $("[data-notify-counsel]").addEventListener("change", async (e) => {
      root.notifyCounsel = e.target.checked;
      log(`${e.target.checked ? "Turned on" : "Turned off"} counsel notification for legal requests`);
      await persist();
    });

    // Tour
    $("[data-tour-next]").addEventListener("click", () => {
      tourStep += 1;
      if (tourStep >= TOUR.length) endTour();
      else showTourStep();
    });
    $("[data-tour-skip]").addEventListener("click", endTour);
    addEventListener("resize", () => { if (tourStep >= 0) showTourStep(); });

    // Counsel may comment or request documents from another tab.
    addEventListener("storage", (e) => {
      if (e.key === "legalxyz.threads" && root && key && $('[data-screen="workspace"]').classList.contains("is-active")) render();
    });
  }

  return { open };
})();
