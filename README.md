# legal.xyz

Privileged, zero-access AI workspace for companies' legal matters.

## Run the prototype

```sh
npm start          # serves public/ at http://localhost:8000
```

Everything runs in the browser and is saved there. The **Demo** button (bottom-right) stands in for the backend: sign as the lawyer, open the lawyer's portal, mark the bar number verified, or reset.

## Tests

```sh
npm install
npx playwright install chromium
npm test
```

`tests/run.mjs` drives Chromium through the home page, sign-up, the workspace (conversations, documents and search, edits, sending to the lawyer, the Lawyer tab), the lawyer's portal (notes, document requests, per-matter legal hold, privilege log PDF), auto-lock, appearance, shortcuts, and a browser with IndexedDB blocked. GitHub Actions runs it on every push (`.github/workflows/test.yml`).

## What's in it

- **Home**: a single quiet screen (mark, one line, and How?, Get access, Contact). The Demo panel opens sign-up. Privilege (how it works, comparison with consumer chatbots, FAQ) and Pricing ($497/month) are their own pages. `homepage/` holds a standalone copy and a prompt to recreate it.
- **Sign-up**: terms acceptance (policies open in place), password strength, lawyer (required), lawyer signs the privilege agreement, recovery code and auto-delete, team.
- **Workspace**:
  - Matters with several conversations each, plus a **Lawyer** tab for direct, encrypted messages with counsel.
  - Send any message to the lawyer for review; edit or delete your own messages (blocked under a legal hold or litigation, with a deletion certificate).
  - Documents up to 25 MB, encrypted in IndexedDB, with text extracted from PDFs, Word and text files so search covers what's inside them.
  - Matter details, deadlines, templates, notifications, exports (PDF and passphrase-encrypted file), archive, delete.
  - Settings: auto-delete, appearance (system, dark, light), auto-lock after inactivity, password, recovery code, devices, team, organization rules, usage, audit log, records, legal-request policy.
  - Keyboard shortcuts (`?` lists them), dialog focus handling, skip link, offline notice.
- **Lawyer's portal** (`#counsel`): shared matters with conversation dividers and items flagged for review, notes and document requests, per-matter and workspace legal holds, privilege log (CSV and PDF), conflict checks.
- **Pages**: Terms, Privacy, DPA (drafts for counsel), Security, Transparency, Help, vulnerability disclosure, `security.txt`.

## Code layout (`public/`)

| File | Purpose |
| --- | --- |
| `app.js` | Routing, sign-up, signing page, policy viewer, demo controls |
| `workspace.js` | The client workspace |
| `counsel.js` | The lawyer's portal |
| `vault.js` | All cryptography and storage |
| `docs.js` | Text extraction from documents |
| `pdf.js` | PDF writer for exports |
| `landing.js` | Home page motion |
| `ui.js` | Toasts, offline notice, appearance, dialog accessibility |
| `analytics.js` | Content-free usage counts |

## Encryption (`public/vault.js`)

- A random 256-bit data key encrypts the workspace with AES-256-GCM in the browser.
- The data key is stored only wrapped: under a key derived from the password (PBKDF2-SHA256, 310,000 iterations) and under a recovery code. That keyring plus the ciphertext is all a server would hold.
- Each device keeps a non-extractable copy of the data key in IndexedDB.
- Shared matters are encrypted to counsel's RSA-OAEP public key; counsel's private key never leaves their device.

## Not built yet

The AI model, and everything that needs a server: see [`docs/launch-checklist.md`](docs/launch-checklist.md).
