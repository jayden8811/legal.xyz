// Client-side vault. All encryption happens in the browser:
// - A random 256-bit data key encrypts the workspace (AES-256-GCM).
// - The data key is stored only "wrapped": once under a key derived from the user's
//   password (PBKDF2-SHA256) and once under a recovery code. That keyring is all a
//   server would ever hold, so legal.xyz can't decrypt anything.
// - This device keeps a non-extractable copy of the data key in IndexedDB.
// - Matters shared with counsel are encrypted to counsel's RSA-OAEP public key.
window.LegalVault = (() => {
  const DB = "legalxyz";
  const KEYS = "keys";
  const FILES = "files";
  const DATA = "legalxyz.vault";
  const RING = "legalxyz.keyring";
  const SHARED = "legalxyz.shared";
  const ITERATIONS = 310000;

  // ---------- Storage ----------

  function idb(mode, fn, store = KEYS) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 2);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS);
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  // Keys also stay in memory for this session, so everything keeps working where the
  // browser blocks IndexedDB (some private windows and embedded previews).
  const memKeys = {};
  const putKey = (name, key) => {
    memKeys[name] = key;
    return idb("readwrite", (s) => s.put(key, name)).catch(() => {});
  };
  const getKey = async (name) => (await idb("readonly", (s) => s.get(name)).catch(() => null)) || memKeys[name] || null;

  const readJSON = (k) => {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  };
  const writeJSON = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  };

  // ---------- Documents ----------
  // Document bytes are encrypted with the workspace key and kept in IndexedDB, outside
  // the main vault, so large files don't hit localStorage limits.

  const memFiles = {};

  async function putFile(key, id, bytes) {
    const box = await sealBytes(key, bytes);
    memFiles[id] = box;
    await idb("readwrite", (s) => s.put(box, id), FILES).catch(() => {});
  }

  async function getFile(key, id) {
    const box = (await idb("readonly", (s) => s.get(id), FILES).catch(() => null)) || memFiles[id];
    return box ? openBytes(key, box) : null;
  }

  function deleteFile(id) {
    delete memFiles[id];
    return idb("readwrite", (s) => s.delete(id), FILES).catch(() => {});
  }

  // ---------- Encoding ----------

  const enc = new TextEncoder();
  const dec = new TextDecoder();

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

  // 24 characters from an unambiguous alphabet (no 0/O, 1/I/L), shown in groups of four.
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function newRecoveryCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
    return chars.match(/.{4}/g).join("-");
  }
  const normalizeCode = (code) => (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  // ---------- Symmetric helpers ----------

  const importAes = (raw, extractable = false) =>
    crypto.subtle.importKey("raw", raw, "AES-GCM", extractable, ["encrypt", "decrypt"]);

  async function sealBytes(key, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
    return { iv: toB64(iv), ct: toB64(ct) };
  }

  async function openBytes(key, box) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct)));
  }

  async function encrypt(key, value) {
    return { v: 1, alg: "AES-256-GCM", ...(await sealBytes(key, enc.encode(JSON.stringify(value)))) };
  }

  async function decrypt(key, box) {
    return JSON.parse(dec.decode(await openBytes(key, box)));
  }

  // ---------- Keyring: data key wrapped by password and by recovery code ----------

  async function deriveKey(secret, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function wrap(secret, raw) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const box = await sealBytes(await deriveKey(secret, salt), raw);
    return { salt: toB64(salt), ...box };
  }

  async function unwrap(secret, wrapped) {
    return openBytes(await deriveKey(secret, fromB64(wrapped.salt)), wrapped);
  }

  const readRing = () => readJSON(RING);
  const hasRing = () => !!readRing();

  // Creates the workspace's data key. Returns the recovery code to show once.
  async function create(password) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const code = newRecoveryCode();
    const ring = {
      fingerprint: await fingerprint(raw),
      byPassword: await wrap(password, raw),
      byRecovery: await wrap(normalizeCode(code), raw),
    };
    writeJSON(RING, ring);
    await putKey("workspace", await importAes(raw));
    return { code, fingerprint: ring.fingerprint };
  }

  // Unlock with either the password or the recovery code. Returns the CryptoKey or null.
  async function unlock(secret) {
    const ring = readRing();
    if (!ring) return null;
    const attempts = [[secret, ring.byPassword], [normalizeCode(secret), ring.byRecovery]];
    for (const [s, w] of attempts) {
      if (!s) continue;
      try {
        const raw = await unwrap(s, w);
        const key = await importAes(raw);
        await putKey("workspace", key);
        return key;
      } catch {}
    }
    return null;
  }

  async function changePassword(current, next) {
    const ring = readRing();
    let raw;
    try { raw = await unwrap(current, ring.byPassword); } catch { return false; }
    ring.byPassword = await wrap(next, raw);
    writeJSON(RING, ring);
    return true;
  }

  async function newRecovery(password) {
    const ring = readRing();
    let raw;
    try { raw = await unwrap(password, ring.byPassword); } catch { return null; }
    const code = newRecoveryCode();
    ring.byRecovery = await wrap(normalizeCode(code), raw);
    writeJSON(RING, ring);
    return code;
  }

  const loadKey = () => getKey("workspace");
  const forgetDevice = () => {
    delete memKeys.workspace;
    return idb("readwrite", (s) => s.delete("workspace")).catch(() => {});
  };

  // ---------- Workspace data ----------

  const readBox = () => readJSON(DATA);
  const writeBox = (box) => writeJSON(DATA, box);

  // ---------- Sharing with counsel (RSA-OAEP + AES-GCM) ----------

  async function createCounselKeys() {
    const pair = await crypto.subtle.generateKey(
      { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["encrypt", "decrypt"]
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    // Re-import the private key as non-extractable before storing it on counsel's device.
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    const priv = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
    await putKey("counsel", priv);
    return publicJwk;
  }

  const loadCounselKey = () => getKey("counsel");

  // Each shared matter has its own key (kept inside the client's encrypted vault). It's
  // wrapped to counsel's public key, so both sides can read and write that matter's
  // comments and document requests, and nobody else can.
  const newShareKey = () => toB64(crypto.getRandomValues(new Uint8Array(32)));

  async function sealForCounsel(publicJwk, value, shareKey) {
    const pub = await crypto.subtle.importKey("jwk", publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const raw = fromB64(shareKey);
    const wk = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, raw));
    return { wk: toB64(wk), ...(await encrypt(await importAes(raw), value)) };
  }

  // Returns the matter and its share key.
  async function openAsCounsel(priv, box) {
    const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, fromB64(box.wk)));
    return { value: await decrypt(await importAes(raw), box), shareKey: toB64(raw) };
  }

  // ---------- Counsel <-> client channel (comments, document requests) ----------

  const THREADS = "legalxyz.threads";
  const readThreads = () => readJSON(THREADS) || {};

  async function postToMatter(shareKey, matterId, entry) {
    const all = readThreads();
    (all[matterId] ||= []).push(await encrypt(await importAes(fromB64(shareKey)), entry));
    writeJSON(THREADS, all);
  }

  async function readMatterThread(shareKey, matterId) {
    const key = await importAes(fromB64(shareKey));
    const out = [];
    for (const box of readThreads()[matterId] || []) {
      try { out.push(await decrypt(key, box)); } catch {}
    }
    return out.sort((a, b) => a.at - b.at);
  }

  function dropMatterThread(matterId) {
    const all = readThreads();
    delete all[matterId];
    writeJSON(THREADS, all);
  }

  // ---------- Passphrase-encrypted export files ----------

  async function exportFile(passphrase, value) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const box = await encrypt(await deriveKey(passphrase, salt), value);
    return JSON.stringify({ format: "legalxyz-export", label: "Privileged & Confidential", kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: toB64(salt), ...box });
  }

  async function sha256(text) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
    return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const readShared = () => readJSON(SHARED) || {};
  const writeShared = (all) => writeJSON(SHARED, all);

  async function clear() {
    Object.keys(memKeys).forEach((k) => delete memKeys[k]);
    [DATA, RING, SHARED, THREADS, "legalxyz.counsel"].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    Object.keys(memFiles).forEach((k) => delete memFiles[k]);
    await idb("readwrite", (s) => s.clear()).catch(() => {});
    await idb("readwrite", (s) => s.clear(), FILES).catch(() => {});
  }

  return {
    fingerprint, create, unlock, hasRing, readRing, changePassword, newRecovery, loadKey, forgetDevice,
    encrypt, decrypt, readBox, writeBox,
    createCounselKeys, loadCounselKey, newShareKey, sealForCounsel, openAsCounsel, readShared, writeShared,
    postToMatter, readMatterThread, dropMatterThread, exportFile, sha256,
    sealBytes, openBytes, importAes, toB64, fromB64, clear, putFile, getFile, deleteFile,
  };
})();
