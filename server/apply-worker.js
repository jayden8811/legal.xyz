// Access applications: stores each one with a timestamp and emails a notification.
// A Cloudflare Worker with a KV namespace (APPLICATIONS) and Resend for email.
// Setup and configuration: server/README.md.

const PERSONAL = /^(gmail|googlemail|yahoo|ymail|rocketmail|hotmail|outlook|live|msn|aol|icloud|me|mac|proton|protonmail|pm|gmx|mail|yandex|zoho|hey|fastmail|tutanota|tuta|qq|163|126|comcast|verizon|att|sbcglobal)\.[a-z.]+$/i;
const SEATS = ["1-2", "3-5", "6-10", "11-25", "25+"];
const LIMITS = { name: 200, email: 254, company: 200, phone: 40 };

const cors = (env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
});
const json = (env, status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(env) } });

// Up to 30 short strings; anything else is dropped.
const list = (v) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string").map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 30);

function clean(body) {
  const str = (k) => (typeof body[k] === "string" ? body[k].trim() : "");
  const app = {
    name: str("name"),
    email: str("email").toLowerCase(),
    company: str("company"),
    seats: str("seats"),
    wants: list(body.wants),
    wantsOther: list(body.wantsOther),
    phone: str("phone"),
    contactConsent: body.contactConsent === true,
  };
  for (const k of ["name", "email", "company", "seats"]) if (!app[k]) return [null, `${k} is required`];
  if (!app.wants.length && !app.wantsOther.length) return [null, "choose at least one thing you want"];
  for (const [k, max] of Object.entries(LIMITS)) if (app[k].length > max) return [null, `${k} is too long`];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.email)) return [null, "email is invalid"];
  if (PERSONAL.test(app.email.split("@")[1])) return [null, "use a business email"];
  if (!SEATS.includes(app.seats)) return [null, "seats is invalid"];
  return [app, null];
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function notify(env, app) {
  const rows = [
    ["Name", app.name], ["Email", app.email], ["Company", app.company], ["Seats", app.seats],
    ["Wants", app.wants.join("\n") || "None"], ["Also wants", app.wantsOther.join("\n") || "None"],
    ["Phone", app.phone || "None"], ["Contact consent", app.contactConsent ? "Yes" : "No"],
    ["Received", app.receivedAt],
  ];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.NOTIFY_EMAIL,
      reply_to: app.email,
      subject: `New legal.xyz application: ${app.company} (${app.seats} seats)`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: `<table>${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return json(env, 405, { error: "method not allowed" });
    let body;
    try {
      body = await request.json();
    } catch {
      return json(env, 400, { error: "invalid JSON" });
    }
    if (body.website) return json(env, 200, { ok: true }); // honeypot
    const [app, error] = clean(body);
    if (error) return json(env, 400, { error });

    app.receivedAt = new Date().toISOString();
    app.submittedAt = typeof body.submittedAt === "string" ? body.submittedAt.slice(0, 40) : null; // browser clock
    app.ip = request.headers.get("CF-Connecting-IP") || null;
    const id = `${app.receivedAt}_${crypto.randomUUID()}`;
    await env.APPLICATIONS.put(`application:${id}`, JSON.stringify(app));

    // Email after responding, so a slow or failed send never loses the stored application.
    ctx.waitUntil(notify(env, app).catch((e) => console.error("notify failed", id, e.message)));
    return json(env, 200, { ok: true, id });
  },
};
