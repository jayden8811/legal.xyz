// Client-side vault. The workspace key is kept in IndexedDB as a non-extractable
// CryptoKey, and chat data is only ever written to storage as AES-GCM ciphertext.
window.LegalVault = (() => {
  const DB = "legalxyz";
  const KEYS = "keys";
  const DATA = "legalxyz.vault";

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(KEYS);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(KEYS, mode);
        const req = fn(tx.objectStore(KEYS));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  const toB64 = (bytes) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function fingerprint(raw) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
    return [...digest.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join(":");
  }

  // Accepts the key as shown to the user (hex groups separated by dashes).
  function parseKey(text) {
    const hex = (text || "").replace(/[^0-9a-f]/gi, "");
    if (hex.length !== 64) return null;
    return new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
  }

  async function saveKey(raw) {
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    // If storage is blocked (private windows), the key still works for this session.
    await idb("readwrite", (s) => s.put(key, "workspace")).catch(() => {});
    return key;
  }

  const loadKey = () => idb("readonly", (s) => s.get("workspace")).catch(() => null);

  async function encrypt(key, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(value));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    return { v: 1, alg: "AES-256-GCM", iv: toB64(iv), ct: toB64(ct) };
  }

  async function decrypt(key, box) {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function readBox() {
    try { return JSON.parse(localStorage.getItem(DATA)); } catch { return null; }
  }

  function writeBox(box) {
    try { localStorage.setItem(DATA, JSON.stringify(box)); } catch {}
  }

  async function clear() {
    try { localStorage.removeItem(DATA); } catch {}
    await idb("readwrite", (s) => s.delete("workspace")).catch(() => {});
  }

  return { fingerprint, parseKey, saveKey, loadKey, encrypt, decrypt, readBox, writeBox, clear };
})();
