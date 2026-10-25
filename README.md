# legal.xyz

Privileged, zero-access AI workspace for companies' legal matters.

## Run the prototype

Static front end in `public/`:

```sh
python3 -m http.server 8000 -d public
```

Then open http://localhost:8000. Everything runs in the browser; progress is saved there, and "Restart demo" on the setup summary (or clearing site data) starts over.

## What's in it

- **Landing page**: logo intro, how it works, what is and isn't protected, pricing (placeholder prices), FAQ, and footer links.
- **Onboarding**: account → lawyer (required) → lawyer signs the privilege agreement (`#sign`) → recovery code and auto-delete → team → workspace. There is no path into the workspace without a signed agreement.
- **Workspace**: matters with chats and document uploads, search, rename, archive, per-matter access, share-with-counsel, a warning when a message looks like business rather than legal, and settings (auto-delete, password, recovery code, device, team roles, activity log, legal-request policy).
- **Counsel portal** (`#counsel`): shared matters, weekly summary, legal hold, privilege log (CSV), bar verification status, and ending the agreement.
- **Policy pages**: `#terms`, `#privacy`, `#dpa` (drafts for counsel to review), `#security`, `#transparency`.

## Encryption (`public/vault.js`)

- A random 256-bit data key encrypts the workspace with AES-256-GCM in the browser.
- The data key is stored only wrapped: under a key derived from the password (PBKDF2-SHA256, 310,000 iterations) and under a recovery code. That keyring plus the ciphertext is all a server would hold.
- Each device keeps a non-extractable copy of the data key in IndexedDB.
- Shared matters are encrypted to counsel's RSA-OAEP public key; counsel's private key never leaves their device.

## Not built yet

- The AI model: replies are placeholders (`demoReply` in `public/workspace.js`).
- A backend: real accounts and sign-in, emails, bar verification against state records, and billing. With real sign-in, the server must never receive the password used for encryption (for example, use a separate authentication secret or a PAKE such as OPAQUE).
