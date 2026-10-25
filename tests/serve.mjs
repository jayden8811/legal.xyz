// Minimal static server for the prototype in public/. Used by the tests and `npm start`.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../public/", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".json": "application/json", ".svg": "image/svg+xml",
};

export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
      let file = join(ROOT, path);
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.env.PORT) || 8000);
  console.log(`legal.xyz prototype at http://localhost:${server.address().port}`);
}
