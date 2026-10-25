// Small shared UI helpers: toast messages and the offline notice.
window.LegalUI = (() => {
  const region = document.createElement("div");
  region.className = "toasts";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.append(region);

  function toast(text, kind = "") {
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    t.textContent = text;
    region.append(t);
    setTimeout(() => t.classList.add("out"), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  // Encryption and storage are local, so offline mostly works; say what doesn't.
  const offline = document.createElement("div");
  offline.className = "offline";
  offline.textContent = "You're offline. You can keep reading and writing; changes reach your lawyer when you reconnect.";
  offline.hidden = navigator.onLine;
  document.body.append(offline);
  addEventListener("online", () => { offline.hidden = true; toast("Back online."); });
  addEventListener("offline", () => { offline.hidden = false; });

  return { toast };
})();

// ---------- Appearance ----------
// System, dark or light. Stored per device; the home page always stays dark.
window.LegalTheme = (() => {
  const KEY = "legalxyz.theme";
  const media = matchMedia("(prefers-color-scheme: light)");
  const get = () => {
    try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; }
  };
  function apply() {
    const pref = get();
    const light = pref === "light" || (pref === "system" && media.matches);
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }
  function set(pref) {
    try { localStorage.setItem(KEY, pref); } catch {}
    apply();
  }
  media.addEventListener?.("change", apply);
  apply();
  return { get, set };
})();

// ---------- Dialog accessibility ----------
// Every overlay is a labelled modal dialog: focus moves in, stays in, and returns.
(() => {
  const overlays = [...document.querySelectorAll("[data-overlay]")];
  const returnTo = new Map();
  // Remember the last thing focused outside any dialog, so closing one can return there.
  let lastOutside = null;
  document.addEventListener("focusin", (e) => {
    if (!e.target.closest("[data-overlay]")) lastOutside = e.target;
  });
  overlays.forEach((o, i) => {
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    const h = o.querySelector("h2");
    if (h) {
      h.id ||= `dialog-title-${i}`;
      o.setAttribute("aria-labelledby", h.id);
    }
    new MutationObserver(() => {
      if (!o.hidden) returnTo.set(o, lastOutside);
      else if (returnTo.get(o)?.isConnected) returnTo.get(o).focus();
    }).observe(o, { attributes: true, attributeFilter: ["hidden"] });
  });

  const focusable = (root) => [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((n) => n.offsetParent !== null);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const open = overlays.filter((o) => !o.hidden).pop();
    if (!open) return;
    const items = focusable(open);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!open.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();
