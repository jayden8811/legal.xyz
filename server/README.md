# Applications and hosting

The site is hosted on Vercel. `public/` is served as static files (`vercel.json` sets it as the output directory) and `api/` holds two serverless functions:

- `POST /api/apply`: the home page's Apply form. Validates name, law firm, email and website, stores the application with a server timestamp (`receivedAt`) in Upstash Redis, then emails it to you through Resend.
- `GET /api/applications`: every application, newest first, for `/admin.html`. Requires `Authorization: Bearer <ADMIN_TOKEN>`.

## Set up on Vercel

1. Import the GitHub repository into Vercel (no framework, no build step; `vercel.json` covers the rest).
2. Storage: in the project, Storage → add **Upstash Redis** from the Marketplace and connect it. It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), which the functions read.
3. Email: create a [Resend](https://resend.com) API key and add these environment variables:
   - `RESEND_API_KEY`
   - `NOTIFY_EMAIL`: where new applications are sent (comma-separate several).
   - `FROM_EMAIL` (optional): a sender on a domain verified in Resend. Without it, mail comes from Resend's shared `onboarding@resend.dev`, which only delivers to the address on your Resend account.
4. `ADMIN_TOKEN`: a long random password for the admin page.
5. Redeploy so the functions pick up the variables.

Then open `/admin.html` on the site, enter the admin token under Settings, and the applications load. Without storage configured, `/api/apply` returns an error and the form asks visitors to try again or email contact@legal.xyz.
