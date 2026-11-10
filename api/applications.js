// GET /api/applications (Authorization: Bearer ADMIN_TOKEN): every application, newest first.
import { KEY, redis, sameToken } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }
  const auth = req.headers.authorization || "";
  if (!process.env.ADMIN_TOKEN || !sameToken(auth, `Bearer ${process.env.ADMIN_TOKEN}`)) return res.status(401).json({ error: "unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const list = await redis("LRANGE", KEY, "0", "-1");
    return res.status(200).json({ applications: list.map((s) => JSON.parse(s)) });
  } catch (e) {
    console.error("list failed", e.message);
    return res.status(500).json({ error: "could not load applications" });
  }
}
