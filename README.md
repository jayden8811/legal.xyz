# legal.xyz

Privileged, zero-access AI workspace for companies' legal matters.

## Onboarding prototype

Static front end in `public/`. Run locally:

```sh
python3 -m http.server 8000 -d public
```

Then open http://localhost:8000.

Flow: account → lawyer (required) → lawyer signs privilege agreement (`#sign`) → client-side encryption key and auto-delete window → team invites → workspace active. There is no path past the signature step without a signed agreement.

After setup, "Open workspace" shows the privileged workspace: chats grouped by legal matter, encrypted on the device with AES-256-GCM before they're saved (`public/vault.js`). "See what legal.xyz stores" shows the ciphertext. The AI model isn't connected yet, so replies are placeholders (`demoReply` in `public/workspace.js`).

Progress is saved in the browser; use "Restart demo" on the last step (or clear site data) to start over.
