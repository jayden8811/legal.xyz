// POST /api/apply: validates an application, stores it with a timestamp, emails a notification.
import { KEY, redis, notify } from "./_lib.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function site(v) {
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

export function clean(body) {
  const str = (k, max) => (typeof body?.[k] === "string" ? body[k].trim().slice(0, max) : "");
  const app = { name: str("name", 200), firm: str("firm", 200), email: str("email", 254).toLowerCase(), website: site(str("website", 300)) };
  for (const k of ["name", "firm", "email"]) if (!app[k]) return [null, `${k} is required`];
  if (!EMAIL.test(app.email)) return [null, "email is invalid"];
  if (!app.website) return [null, "website is invalid"];
  return [app, null];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (body.fax) return res.status(200).json({ ok: true }); // honeypot
  const [app, error] = clean(body);
  if (error) return res.status(400).json({ error });

  app.receivedAt = new Date().toISOString();
  app.submittedAt = typeof body.submittedAt === "string" ? body.submittedAt.slice(0, 40) : null; // browser clock
  app.id = `${app.receivedAt}_${crypto.randomUUID().slice(0, 8)}`;
  try {
    await redis("LPUSH", KEY, JSON.stringify(app));
  } catch (e) {
    console.error("store failed", e.message);
    return res.status(500).json({ error: "could not save the application" });
  }
  // The application is saved; a failed email shouldn't fail the visitor's submission.
  try {
    await notify(app);
  } catch (e) {
    console.error("notify failed", app.id, e.message);
  }
  return res.status(200).json({ ok: true, id: app.id });
}
