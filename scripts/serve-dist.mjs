/**
 * Server static minimal pentru `dist/client`, cu fallback SPA.
 *
 * De ce nu `vite preview`: pe Windows configul principal cade în
 * `@lovable.dev/mcp-js` (compară o cale cu `/` față de una cu `\`), deci nici
 * `bun run dev`, nici `bun run build` nu pornesc local. Acesta servește
 * bundle-ul deja construit de `bun run build:mobile`, fără Vite.
 *
 * Folosire: `node scripts/serve-dist.mjs [port]`
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const ROOT = new URL("../dist/client/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = Number(process.argv[2] || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function send(res, file, status = 200) {
  const body = await readFile(file);
  res.writeHead(status, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    // Fără cache: altfel verific un bundle vechi și trag concluzii greșite.
    "cache-control": "no-store",
  });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    // `normalize` + prefixul obligatoriu opresc traversarea în afara ROOT.
    const target = normalize(join(ROOT, url));
    if (!target.startsWith(normalize(ROOT))) {
      res.writeHead(403).end("forbidden");
      return;
    }
    try {
      const s = await stat(target);
      if (s.isFile()) return await send(res, target);
      return await send(res, join(target, "index.html"));
    } catch {
      // Fallback SPA: rutele client-side nu au fișier pe disc.
      return await send(res, join(ROOT, "index.html"));
    }
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`dist/client servit pe http://localhost:${PORT}`);
});
