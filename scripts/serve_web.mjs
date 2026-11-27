import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/web/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
};
const port = Number(process.argv[2] ?? 4173);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const name = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const path = resolve(root, name);
    if (relative(root, path).startsWith("..")) throw new Error("Outside demo directory");
    const content = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
  } catch {
    res.writeHead(404).end("File unavailable");
  }
}).listen(port, "127.0.0.1", () => console.log(`IFC demo at http://127.0.0.1:${port}/`));
