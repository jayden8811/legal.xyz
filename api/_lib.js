// Shared by the application functions: storage in Upstash Redis (Vercel Marketplace)
// and email through Resend. Both are reached over HTTPS, so there are no dependencies.

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const KEY = "applications";

export async function redis(...command) {
  if (!redisUrl() || !redisToken()) throw new Error("Storage is not configured (add Upstash Redis to the Vercel project).");
  const res = await fetch(redisUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Redis ${res.status}: ${body.error || "request failed"}`);
  return body.result;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function notify(app) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) return false;
  const rows = [["Name", app.name], ["Law firm", app.firm], ["Email", app.email], ["Website", app.website], ["Received", app.receivedAt]];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Resend's shared sender works without a verified domain, for mail to your own address.
      from: process.env.FROM_EMAIL || "legal.xyz <onboarding@resend.dev>",
      to: process.env.NOTIFY_EMAIL.split(",").map((e) => e.trim()),
      reply_to: app.email,
      subject: `New legal.xyz application: ${app.firm}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: `<table>${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return true;
}

// Constant-time comparison, so the admin token can't be guessed byte by byte.
export function sameToken(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
