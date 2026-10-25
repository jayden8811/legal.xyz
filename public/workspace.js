// The privileged workspace: chats and documents grouped by legal matter, encrypted on
// this device. The AI model isn't connected yet; replies come from demoReply() until the
// backend exists.
window.LegalWorkspace = (() => {
  const V = window.LegalVault;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const DAY = 86400000;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_FILE = 1024 * 1024; // demo storage is the browser's, so keep files small

  let profile = {};          // onboarding state, shared with app.js
  let saveProfile = () => {};
  let key = null;            // CryptoKey, never leaves the device
  let data = null;
  let wired = false;
  let query = "";
  let showArchived = false;
  let pendingFiles = [];
  let fileReads = Promise.resolve(); // sending waits for attachments still being read
  let bizOverride = false;
  let matterFormMode = "new";
  let inviteAcknowledged = "";

  const active = () => data.matters.find((m) => m.id === data.activeId) || null;
  const uid = () => crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12);
  const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const day = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const domainOf = (email) => (email || "").split("@")[1]?.toLowerCase() || "";
  const me = () => profile.name || "You";
  const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- Persistence ----------

  function log(text) {
    data.activity.unshift({ at: Date.now(), who: me(), text });
    data.activity.length = Math.min(data.activity.length, 300);
  }

  async function persist() {
    const ok = V.writeBox(await V.encrypt(key, data));
    await syncShared();
    return ok;
  }

  // Shared matters are re-encrypted to counsel's public key. File contents stay with the
  // client; counsel sees file names and can ask for the documents.
  async function syncShared() {
    if (!profile.counselPublicKey) return;
    const out = {};
    for (const m of data.matters.filter((x) => x.shared)) {
      out[m.id] = await V.sealForCounsel(profile.counselPublicKey, {
        id: m.id,
        name: m.name,
        company: profile.company,
        sharedAt: m.sharedAt,
        messages: m.messages.map(({ role, text, at, author, files }) => ({
          role, text, at, author, files: (files || []).map((f) => ({ name: f.name, size: f.size })),
        })),
      });
    }
    V.writeShared(out);
  }

  function seed() {
    const members = [{ email: (profile.email || "").toLowerCase(), name: profile.name, role: "owner", status: "active" }];
    (profile.team || []).forEach((email) => members.push({ email, role: "member", status: "invited" }));
    return { matters: [], activeId: null, members, activity: [], notifyCounsel: true };
  }

  // Drop messages older than the auto-delete window, unless counsel has placed a legal hold.
  function applyRetention() {
    if (profile.legalHold) return;
    const cutoff = Date.now() - Number(profile.retention || 90) * DAY;
    let removed = 0;
    data.matters.forEach((m) => {
      const before = m.messages.length;
      m.messages = m.messages.filter((msg) => msg.at >= cutoff);
      removed += before - m.messages.length;
    });
    if (removed) log(`Auto-deleted ${removed} message${removed === 1 ? "" : "s"} older than ${profile.retention || 90} days`);
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
      data = box ? await V.decrypt(key, box) : seed();
    } catch {
      await V.forgetDevice();
      key = null;
      return showUnlock("The key on this device doesn't match this workspace. Enter your password.");
    }
    data.members ||= seed().members;
    data.activity ||= [];
    if (!box) log("Workspace created");
    applyRetention();
    await persist();
    render();
  }

  // ---------- Rendering ----------

  function render() {
    renderStatus();
    renderMatters();
    renderThread();
  }

  function renderStatus() {
    $("[data-ws-company]").textContent = profile.company || "";
    $("[data-ws-counsel]").textContent = profile.signer || profile.lawyerName || "";
    $("[data-ws-bar]").textContent = profile.barStatus === "verified" ? "verified" : "verification pending";
    const days = Number(profile.retention || 90);
    $("[data-ws-retention]").textContent = profile.legalHold ? "paused" : days >= 365 ? "after 1 year" : `after ${days} days`;
    $("[data-ws-hold]").textContent = profile.legalHold ? "on" : "off";
    $("[data-hold-banner]").hidden = !profile.legalHold;
  }

  function matches(m) {
    if (!query) return { ok: true };
    const q = query.toLowerCase();
    if (m.name.toLowerCase().includes(q)) return { ok: true };
    const hit = m.messages.find((msg) => msg.text.toLowerCase().includes(q) || (msg.files || []).some((f) => f.name.toLowerCase().includes(q)));
    if (!hit) return { ok: false };
    const i = hit.text.toLowerCase().indexOf(q);
    const snippet = i >= 0 ? `…${hit.text.slice(Math.max(0, i - 20), i + q.length + 30)}…` : "Matching document";
    return { ok: true, snippet };
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

    if (!list.length) {
      nav.append(el("p", "matters-empty", query ? "No matches." : showArchived ? "No archived matters." : "No matters yet."));
    }
    list.forEach(({ m, hit }) => {
      const btn = el("button", "matter" + (m.id === data.activeId ? " is-active" : ""));
      btn.type = "button";
      btn.append(el("span", "matter-name", m.name));
      const meta = hit.snippet || `${m.messages.length} message${m.messages.length === 1 ? "" : "s"}${m.shared ? " · shared with counsel" : ""}`;
      btn.append(el("span", "matter-meta", meta));
      btn.addEventListener("click", () => {
        data.activeId = m.id;
        document.body.classList.remove("side-open");
        clearComposer();
        persist();
        render();
      });
      nav.append(btn);
    });

    const toggle = $("[data-toggle-archived]");
    toggle.hidden = !archivedCount && !showArchived;
    toggle.textContent = showArchived ? "Back to active matters" : `Archived (${archivedCount})`;
  }

  function renderThread() {
    const m = active();
    const thread = $("[data-thread]");
    $("[data-matter-title]").textContent = m ? m.name : "Your workspace";
    $("[data-matter-actions]").hidden = !m;
    $("[data-composer]").hidden = !m || m.archived;
    thread.replaceChildren();

    if (!m) {
      thread.append($("#ws-empty").content.cloneNode(true));
      $("[data-empty-new]", thread).addEventListener("click", () => showMatterForm("new"));
      return;
    }

    $("[data-share-counsel]").checked = !!m.shared;
    $("[data-archive]").textContent = m.archived ? "Restore from archive" : "Archive";

    if (m.archived) thread.append(el("p", "thread-intro", "This matter is archived. Restore it to keep chatting."));
    else if (!m.messages.length) thread.append(el("p", "thread-intro", "Ask anything about this matter, or attach a document. Keep it to legal questions so it stays within privilege."));
    m.messages.forEach((msg) => thread.append(bubble(msg)));
    thread.scrollTop = thread.scrollHeight;
  }

  function bubble(msg) {
    const wrap = el("div", `msg msg-${msg.role}`);
    if (msg.text) wrap.append(el("div", "msg-body", msg.text));
    if (msg.files?.length) {
      const files = el("div", "attachments");
      msg.files.forEach((f) => {
        const chip = el("button", "file-chip");
        chip.type = "button";
        chip.title = "Download";
        chip.append(el("span", "file-name", f.name), el("span", "file-size", kb(f.size)));
        chip.addEventListener("click", () => downloadFile(f));
        files.append(chip);
      });
      wrap.append(files);
    }
    wrap.append(el("div", "msg-meta", `${msg.role === "user" ? msg.author || me() : "legal.xyz"} · ${when(msg.at)}`));
    return wrap;
  }

  function downloadFile(f) {
    const bytes = V.fromB64(f.data);
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([bytes], { type: f.type || "application/octet-stream" })),
      download: f.name,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  // ---------- Composer ----------

  const LEGAL = /\b(law|legal|lawyer|attorney|counsel|court|sue|suing|lawsuit|litigat\w*|claim|dispute|contract|agreement|lease|tenant|landlord|clause|breach|liab\w*|indemn\w*|warrant\w*|compl\w*|regulat\w*|statute|permit|zoning|lien|evict\w*|terminat\w*|settle\w*|damages|negligen\w*|trademark|patent|copyright|privilege|subpoena|notice|employment|discriminat\w*|harass\w*|rights?|obligat\w*|enforce\w*|arbitrat\w*|deposition|demand letter)\b/i;
  const BUSINESS = /\b(revenue|profit|margin|marketing|branding|pricing|sales|growth|kpi|forecast|budget|investor|pitch|fundrais\w*|campaign|social media|ads?|seo|hiring plan|roadmap|valuation|go-to-market|customer acquisition)\b/i;
  const looksBusiness = (text) => BUSINESS.test(text) && !LEGAL.test(text);

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
      const x = el("button", "file-remove", "×");
      x.type = "button";
      x.setAttribute("aria-label", `Remove ${f.name}`);
      x.addEventListener("click", () => { pendingFiles.splice(i, 1); renderPending(); });
      chip.append(x);
      box.append(chip);
    });
  }

  async function addFiles(list) {
    const err = $("[data-file-error]");
    err.textContent = "";
    for (const file of list) {
      if (file.size > MAX_FILE) {
        err.textContent = `${file.name} is over 1 MB, the limit in this demo.`;
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      pendingFiles.push({ id: uid(), name: file.name, type: file.type, size: file.size, data: V.toB64(bytes) });
    }
    renderPending();
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
    if (pendingFiles.length) log(`Uploaded ${pendingFiles.map((f) => f.name).join(", ")} to "${m.name}"`);
    if (!(await persist())) {
      m.messages.pop();
      $("[data-file-error]").textContent = "This browser's storage is full. Remove large documents and try again.";
      return;
    }
    const input = $("[data-composer] textarea");
    input.value = "";
    input.style.height = "";
    clearComposer();
    render();

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
    } else {
      const m = { id: uid(), name, shared: false, archived: false, access: null, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      data.matters.push(m);
      data.activeId = m.id;
      showArchived = false;
      log(`Created matter "${name}"`);
    }
    await persist();
    render();
  }

  // ---------- Overlays ----------

  function overlay(name, show) {
    const o = $(`[data-overlay="${name}"]`);
    o.hidden = !show;
    if (show) o.querySelector("input:not([type=checkbox]), select, textarea, button")?.focus();
  }

  function showMatterForm(mode) {
    matterFormMode = mode;
    const form = $("[data-new-matter-form]");
    form.reset();
    $("[data-error]", form).textContent = "";
    $("[data-matter-form-title]").textContent = mode === "rename" ? "Rename matter" : "New matter";
    $("[data-matter-form-submit]").textContent = mode === "rename" ? "Save name" : "Create matter";
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
      const label = el("span", null, `${p.name || p.email} · ${p.role}${p.status === "invited" ? " (invited)" : ""}`);
      row.append(box, label);
      list.append(row);
    });
    overlay("access", true);
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

  // ---------- Settings ----------

  function openSettings(tab = "general") {
    selectTab(tab);
    overlay("settings", true);
  }

  function selectTab(tab) {
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $$("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    if (tab === "general") renderGeneral();
    if (tab === "security") $("[data-set-fp]").textContent = V.readRing()?.fingerprint || profile.keyFingerprint || "";
    if (tab === "team") renderTeam();
    if (tab === "activity") renderActivity();
    if (tab === "requests") $("[data-notify-counsel]").checked = data.notifyCounsel !== false;
  }

  function renderGeneral() {
    $("[data-set-retention]").value = profile.retention || "90";
    $("[data-set-retention]").disabled = !!profile.legalHold;
    $("[data-set-hold]").textContent = profile.legalHold
      ? "Legal hold is on, so auto-delete is paused. Only your lawyer can lift it."
      : "Your lawyer can place a legal hold, which pauses auto-delete for every matter.";
    $("[data-set-counsel]").textContent = `${profile.signer || profile.lawyerName}, ${profile.firm} · Bar #${profile.bar} (${profile.barState})`;
    $("[data-set-signed]").textContent = profile.signedAt ? day(profile.signedAt) : "";
    $("[data-set-bar]").textContent = profile.barStatus === "verified" ? "Verified" : "Pending review against state bar records";
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
      const remove = el("button", "btn btn-ghost btn-sm", "Remove");
      remove.type = "button";
      remove.disabled = self;
      remove.addEventListener("click", async () => {
        data.members.splice(i, 1);
        data.matters.forEach((m) => { if (m.access) m.access = m.access.filter((e) => e !== p.email); });
        log(`Removed ${p.email}`);
        await persist();
        renderTeam();
      });
      row.append(who, role, remove);
      list.append(row);
    });
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

  function formError(form, msg, ok = false) {
    const out = $("[data-error]", form);
    out.textContent = msg;
    out.classList.toggle("ok", ok);
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

    // Matter menu
    const menu = $("[data-menu]");
    const menuBtn = $("[data-menu-toggle]");
    const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); };
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      menuBtn.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", closeMenu);
    $("[data-rename]").addEventListener("click", () => { closeMenu(); showMatterForm("rename"); });
    $("[data-access]").addEventListener("click", () => { closeMenu(); showAccess(); });
    $("[data-archive]").addEventListener("click", async () => {
      closeMenu();
      const m = active();
      m.archived = !m.archived;
      log(`${m.archived ? "Archived" : "Restored"} "${m.name}"`);
      showArchived = m.archived;
      await persist();
      render();
    });

    $("[data-new-matter-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = e.target.elements.matter.value.trim();
      if (!name) return formError(e.target, 'Give the matter a name, like "Main St. lease dispute".');
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

    $("[data-share-counsel]").addEventListener("change", async (e) => {
      const m = active();
      m.shared = e.target.checked;
      if (m.shared) m.sharedAt = Date.now();
      log(`${m.shared ? "Shared" : "Stopped sharing"} "${m.name}" with counsel`);
      await persist();
      renderMatters();
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
      fileReads = fileReads.then(() => addFiles(files));
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
      log(`Changed auto-delete to ${e.target.selectedOptions[0].textContent}`);
      applyRetention();
      await persist();
      render();
    });

    // Settings: security
    $("[data-pw-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { current, next } = e.target.elements;
      if (next.value.length < 12) return formError(e.target, "The new password must be at least 12 characters.");
      formError(e.target, "Checking…", true);
      if (!(await V.changePassword(current.value, next.value))) return formError(e.target, "Your current password is incorrect.");
      e.target.reset();
      formError(e.target, "");
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

    $("[data-forget-device]").addEventListener("click", async () => {
      await V.forgetDevice();
      key = null;
      overlay("settings", false);
      showUnlock("This device no longer has your key. Enter your password to unlock again.");
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
      if (domainOf(email) !== own && inviteAcknowledged !== email) {
        inviteAcknowledged = email;
        $("[data-invite-submit]").textContent = "Invite anyway";
        return formError(invite, `${email} is outside @${own}. Inviting outsiders can waive privilege.`);
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

    // Settings: legal requests
    $("[data-notify-counsel]").addEventListener("change", async (e) => {
      data.notifyCounsel = e.target.checked;
      log(`${e.target.checked ? "Turned on" : "Turned off"} counsel notification for legal requests`);
      await persist();
    });
  }

  return { open };
})();
