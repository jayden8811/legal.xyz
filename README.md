# legal.xyz

Privileged, zero-access AI workspace for companies' legal matters.

## Run the prototype

Static front end in `public/`:

```sh
python3 -m http.server 8000 -d public
```

Then open http://localhost:8000. Everything runs in the browser; progress is saved there, and "Restart demo" on the setup summary (or clearing site data) starts over.

## What's in it

- **Landing page** (`public/landing.js` for motion): headline with rotating AI names, 3D dot globe, type-and-encrypt showcase, scroll reveals, how privilege works, pricing ($497/month, one plan), FAQ, footer.
- **Onboarding**: account → lawyer (required; or request a lawyer introduction) → lawyer signs the privilege agreement (`#sign`) → recovery code and auto-delete → team → workspace. No path into the workspace without a signed agreement.
- **Workspace**:
  - Multiple workspaces per company; matters with chats and encrypted documents (with a viewer), search, rename, archive, delete, per-matter access.
  - Matter details (opposing party, case number, status), deadlines with reminders, request templates, and a notification center.
  - Share with counsel; counsel notes and document requests appear in the thread, with replies and uploads.
  - Litigation status freezes a matter's record (SHA-256) and blocks deletion; per-matter auto-delete; deletion certificates (PDF).
  - Exports: PDF stamped Privileged & Confidential on every page, or a passphrase-encrypted file.
  - Settings: auto-delete, signed agreement (PDF), password, recovery code, devices, team roles, organization rules (invite domain, exports, analytics, data residency), usage, audit log (CSV/PDF), activity, records, legal-request policy.
  - Business-topic warning and a first-run tour.
- **Counsel portal** (`#counsel`): client list with conflict checks, legal hold, signed agreement (PDF), end agreement, weekly summary, firm roster, shared matters with notes and document requests, privilege log (CSV).
- **Pages**: `#terms`, `#privacy`, `#dpa` (drafts for counsel to review), `#security`, `#transparency`, `#help`, `#disclosure`, plus `/.well-known/security.txt`.
- **Installable app**: web app manifest and an offline service worker.
- **Analytics** (`public/analytics.js`): allowlisted event counts only, never content; owners can turn it off.

## Encryption (`public/vault.js`)

- A random 256-bit data key encrypts the workspace with AES-256-GCM in the browser.
- The data key is stored only wrapped: under a key derived from the password (PBKDF2-SHA256, 310,000 iterations) and under a recovery code. That keyring plus the ciphertext is all a server would hold.
- Each device keeps a non-extractable copy of the data key in IndexedDB.
- Shared matters are encrypted to counsel's RSA-OAEP public key; counsel's private key never leaves their device.

## Not built yet

The AI model, and everything that needs a server: see [`docs/launch-checklist.md`](docs/launch-checklist.md).
