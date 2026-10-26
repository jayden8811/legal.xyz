# Access applications

The "Get access" form posts JSON to the URL in `data-apply-endpoint` on `<form data-apply-form>` in `public/index.html`. With no URL set, the prototype keeps applications in the visitor's browser only (`localStorage["legalxyz.applications"]`), so set one before going live.

Each application has `name`, `email`, `company`, `seats`, `matters`, `currentApproach`, `phone`, `contactConsent` and `submittedAt`.

## Option A: this repo's Worker (data stays in your accounts)

`apply-worker.js` validates the application, stores it in Cloudflare KV with a server timestamp (`receivedAt`), then emails it to you through [Resend](https://resend.com).

1. In Resend, verify a sending domain and create an API key.
2. From `server/`:
   ```sh
   npx wrangler kv namespace create APPLICATIONS   # paste the id into wrangler.toml
   npx wrangler secret put RESEND_API_KEY
   npx wrangler deploy
   ```
3. Set `NOTIFY_EMAIL`, `FROM_EMAIL` and `ALLOWED_ORIGIN` in `wrangler.toml` (redeploy after changes).
4. Put the Worker URL (e.g. `https://legalxyz-apply.<you>.workers.dev`) in `data-apply-endpoint`.

List stored applications: `npx wrangler kv key list --binding APPLICATIONS --remote`, then `npx wrangler kv key get --binding APPLICATIONS --remote "<key>"`.

## Option B: a hosted form service (no code to run)

Services such as Formspree accept the same JSON post, keep each submission with a timestamp in a dashboard, and email you on every one. Create a form there and put its endpoint (e.g. `https://formspree.io/f/<id>`) in `data-apply-endpoint`. Applicant details are then held by that service.
