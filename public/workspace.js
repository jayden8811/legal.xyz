// The privileged workspace: chats grouped by legal matter, encrypted on this device.
// The AI model isn't connected yet; replies come from demoReply() until the backend exists.
window.LegalWorkspace = (() => {
  const V = window.LegalVault;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const DAY = 86400000;

  let profile = {};       // onboarding state (company, counsel, retention, fingerprint)
  let key = null;         // CryptoKey, never leaves the device
  let data = { matters: [], activeId: null };
  let wired = false;

  const active = () => data.matters.find((m) => m.id === data.activeId) || null;
  const uid = () => crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12);
  const time = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  async function persist() {
    V.writeBox(await V.encrypt(key, data));
  }

  // Drop messages older than the customer's auto-delete window.
  function applyRetention() {
    const cutoff = Date.now() - Number(profile.retention || 90) * DAY;
    data.matters.forEach((m) => { m.messages = m.messages.filter((msg) => msg.at >= cutoff); });
  }

  async function open(state) {
    profile = state;
    wire();
    $("[data-ws-company]").textContent = profile.company || "";
    $("[data-ws-counsel]").textContent = profile.signer || profile.lawyerName || "";
    const days = Number(profile.retention || 90);
    $("[data-ws-retention]").textContent = days >= 365 ? "1 year" : `${days} days`;

    key = await V.loadKey();
    if (!key) return showUnlock();
    await load();
  }

  async function load() {
    const box = V.readBox();
    if (box) {
      try {
        data = await V.decrypt(key, box);
      } catch {
        return showUnlock("The key on this device doesn't match your workspace. Paste your saved key.");
      }
    }
    applyRetention();
    await persist();
    render();
  }

  // ---------- Rendering ----------

  function render() {
    renderMatters();
    renderThread();
  }

  function renderMatters() {
    const nav = $("[data-matters]");
    nav.replaceChildren();
    if (!data.matters.length) {
      const p = document.createElement("p");
      p.className = "matters-empty";
      p.textContent = "No matters yet.";
      nav.append(p);
    }
    data.matters
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((m) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "matter" + (m.id === data.activeId ? " is-active" : "");
        btn.innerHTML = `<span class="matter-name"></span><span class="matter-meta"></span>`;
        btn.querySelector(".matter-name").textContent = m.name;
        btn.querySelector(".matter-meta").textContent = `${m.messages.length} message${m.messages.length === 1 ? "" : "s"}${m.shared ? " · shared with counsel" : ""}`;
        btn.addEventListener("click", () => {
          data.activeId = m.id;
          document.body.classList.remove("side-open");
          persist();
          render();
        });
        nav.append(btn);
      });
  }

  function renderThread() {
    const m = active();
    const thread = $("[data-thread]");
    const composer = $("[data-composer]");
    $("[data-matter-title]").textContent = m ? m.name : "Your workspace";
    $("[data-share-wrap]").hidden = !m;
    composer.hidden = !m;
    thread.replaceChildren();

    if (!m) {
      thread.append($("#ws-empty").content.cloneNode(true));
      $("[data-empty-new]", thread)?.addEventListener("click", showNewMatter);
      return;
    }

    $("[data-share-counsel]").checked = !!m.shared;
    if (!m.messages.length) {
      const intro = document.createElement("div");
      intro.className = "thread-intro";
      intro.innerHTML = "<p>Ask anything about this matter. Keep it to legal questions so it stays within privilege.</p>";
      thread.append(intro);
    }
    m.messages.forEach((msg) => thread.append(bubble(msg)));
    thread.scrollTop = thread.scrollHeight;
    $("textarea", composer).focus({ preventScroll: true });
  }

  function bubble(msg) {
    const el = document.createElement("div");
    el.className = `msg msg-${msg.role}`;
    const body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = msg.text;
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.textContent = `${msg.role === "user" ? profile.name || "You" : "legal.xyz"} · ${time(msg.at)}`;
    el.append(body, meta);
    return el;
  }

  // ---------- Actions ----------

  function demoReply(matter) {
    return `Demo reply: the AI model isn't connected yet. In production, your question about "${matter.name}" would be answered by a model under a zero-data-retention agreement, and this reply would be encrypted on your device like everything else here.`;
  }

  async function send(text) {
    const m = active();
    if (!m || !text.trim()) return;
    m.messages.push({ role: "user", text: text.trim(), at: Date.now() });
    m.updatedAt = Date.now();
    await persist();
    render();

    const typing = document.createElement("div");
    typing.className = "msg msg-assistant typing";
    typing.innerHTML = '<div class="msg-body"><span></span><span></span><span></span></div>';
    $("[data-thread]").append(typing);
    $("[data-thread]").scrollTop = $("[data-thread]").scrollHeight;

    setTimeout(async () => {
      m.messages.push({ role: "assistant", text: demoReply(m), at: Date.now() });
      m.updatedAt = Date.now();
      await persist();
      if (active() === m) render();
    }, 900);
  }

  async function createMatter(name) {
    const m = { id: uid(), name, shared: false, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    data.matters.push(m);
    data.activeId = m.id;
    await persist();
    render();
  }

  // ---------- Overlays ----------

  function overlay(name, show) {
    $(`[data-overlay="${name}"]`).hidden = !show;
    if (show) $(`[data-overlay="${name}"] input, [data-overlay="${name}"] textarea, [data-overlay="${name}"] button`)?.focus();
  }

  function showNewMatter() {
    const form = $("[data-new-matter-form]");
    form.reset();
    $("[data-error]", form).textContent = "";
    overlay("new", true);
  }

  function showUnlock(msg = "") {
    $("[data-unlock-error]").textContent = msg;
    $("[data-unlock-fp]").textContent = profile.keyFingerprint || "";
    overlay("unlock", true);
  }

  // What legal.xyz's servers would hold: the encrypted box, nothing readable.
  function showCipher() {
    const box = V.readBox() || {};
    const shown = { ...box, ct: box.ct && box.ct.length > 600 ? box.ct.slice(0, 600) + "…" : box.ct };
    $("[data-cipher-text]").textContent = JSON.stringify(shown, null, 2);
    overlay("cipher", true);
  }

  function wire() {
    if (wired) return;
    wired = true;

    $("[data-new-matter]").addEventListener("click", showNewMatter);
    $("[data-view-cipher]").addEventListener("click", showCipher);
    $("[data-toggle-side]").addEventListener("click", () => document.body.classList.toggle("side-open"));
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => { b.closest("[data-overlay]").hidden = true; }));
    $$("[data-overlay]").forEach((o) => o.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && o.dataset.overlay !== "unlock") o.hidden = true;
    }));

    $("[data-new-matter-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = e.target.elements.matter.value.trim();
      if (!name) {
        $("[data-error]", e.target).textContent = "Give the matter a name, like \"Main St. lease dispute\".";
        return;
      }
      overlay("new", false);
      await createMatter(name);
    });

    $("[data-share-counsel]").addEventListener("change", async (e) => {
      const m = active();
      if (!m) return;
      m.shared = e.target.checked;
      await persist();
      renderMatters();
    });

    const composer = $("[data-composer]");
    const input = $("textarea", composer);
    composer.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = "";
      input.style.height = "";
      send(text);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        composer.requestSubmit();
      }
    });
    input.addEventListener("input", () => {
      input.style.height = "";
      input.style.height = Math.min(input.scrollHeight, 180) + "px";
    });

    $("[data-unlock-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = V.parseKey(e.target.elements.key.value);
      const err = $("[data-unlock-error]");
      if (!raw) {
        err.textContent = "That doesn't look like a legal.xyz key. It should be 64 characters in groups of four.";
        return;
      }
      if (profile.keyFingerprint && (await V.fingerprint(raw)) !== profile.keyFingerprint) {
        err.textContent = "This key doesn't match your workspace's fingerprint.";
        return;
      }
      key = await V.saveKey(raw);
      e.target.reset();
      overlay("unlock", false);
      await load();
    });
  }

  return { open };
})();
