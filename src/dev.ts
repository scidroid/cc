import fs from "fs";
import path from "path";
import { watch } from "fs";
import { compile, minifyHTML, read, write } from "@/engine";
import type { ServerWebSocket } from "bun";

declare global {
  var clients: Set<ServerWebSocket<unknown>>;
  var watcher: boolean;
}

const PORT = 3000;

// Preserve state across hot reloads
globalThis.clients ??= new Set<ServerWebSocket<unknown>>();
globalThis.watcher ??= false;

const clients = globalThis.clients;
const LIVE_RELOAD_SCRIPT = `<script>new WebSocket('ws://'+location.host+'/__reload').onmessage=()=>location.reload()</script></body>`;

function build() {
  const start = Date.now();
  try {
    const data = JSON.parse(read("../resume.json"));
    fs.mkdirSync(path.resolve(__dirname, "../docs"), { recursive: true });

    const publicDir = path.resolve(__dirname, "../public");
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, path.resolve(__dirname, "../docs"), {
        recursive: true,
      });
    }

    write("../docs/index.html", minifyHTML(compile("html/index.html", data)));
    console.log(`[dev] Built in ${Date.now() - start}ms`);
    return true;
  } catch (e) {
    console.error("[dev] Build failed:", e);
    return false;
  }
}

function reload() {
  clients.forEach((ws) => {
    try {
      ws.send("reload");
    } catch {}
  });
}

// Debounced rebuild
let timeout: Timer | null = null;
function rebuild() {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => build() && reload(), 50);
}

// Set up watchers only once
if (!globalThis.watcher) {
  [
    path.resolve(__dirname, "../resume.json"),
    path.resolve(__dirname, "html"),
    path.resolve(__dirname, "../public"),
  ].forEach((p) => {
    if (fs.existsSync(p)) {
      watch(
        p,
        { recursive: true },
        (_, f) => f && !f.startsWith(".") && rebuild()
      );
    }
  });
  globalThis.watcher = true;
}

// Initial build
build();

// Server
const docsDir = path.resolve(__dirname, "../docs");

Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/__reload") {
      return server.upgrade(req)
        ? undefined
        : new Response("Upgrade failed", { status: 400 });
    }

    const filePath = path.join(
      docsDir,
      url.pathname === "/" ? "index.html" : url.pathname
    );
    const file = Bun.file(filePath);

    if (filePath.endsWith(".html")) {
      return file
        .text()
        .then(
          (html) =>
            new Response(html.replace("</body>", LIVE_RELOAD_SCRIPT), {
              headers: { "Content-Type": "text/html" },
            })
        )
        .catch(() => new Response("Not found", { status: 404 }));
    }

    return new Response(file);
  },
  websocket: {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
    message() {},
  },
});

console.log(`[dev] http://localhost:${PORT}`);
