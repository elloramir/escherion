#!/usr/bin/env node
// Dev server: static files from the project root, live reload over WebSocket and
// a proxy to game.aq.com so the SWF's relative `/game/...` and `/api/...` loads
// work from this origin (the API sends no CORS headers).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import chokidar from "chokidar";
import { WebSocketServer } from "ws";
import { createProxyMiddleware } from "http-proxy-middleware";
import { startSocketProxy } from "./socket-proxy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 8080);
const AQW = process.env.AQW_ORIGIN ?? "https://game.aq.com";
const WATCH = ["source", "tools"];

const RELOAD_SNIPPET = `<script>
(() => {
    const socket = new WebSocket("ws://" + location.host + "/__reload");
    socket.addEventListener("message", () => location.reload());
})();
</script>`;

const app = express();

// Proxy first so /game and /api never hit the static handler.
app.use(createProxyMiddleware({
    target: AQW,
    changeOrigin: true,
    pathFilter: ["/game/**", "/api/**"],
}));

app.get("/", (request, response) => response.redirect("/source/index.html"));
app.get("/source/", (request, response) => response.redirect("/source/index.html"));

// Serve HTML with the reload snippet injected.
app.use((request, response, next) => {
    if (!request.path.endsWith(".html")) return next();
    const file = path.join(ROOT, request.path);
    fs.readFile(file, "utf8", (error, html) => {
        if (error) return next();
        response.type("html").send(html.replace("</body>", `${RELOAD_SNIPPET}</body>`));
    });
});

app.use(express.static(ROOT, { extensions: ["html"] }));

const server = http.createServer(app);

const sockets = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/__reload") return socket.destroy();
    sockets.handleUpgrade(request, socket, head, (client) => sockets.emit("connection", client));
});

let pending = null;
const watcher = chokidar.watch(WATCH.map((dir) => path.join(ROOT, dir)), { ignoreInitial: true });
watcher.on("all", () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
        for (const client of sockets.clients) client.send("reload");
    }, 60);
});

server.listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT} (proxy ${AQW})`));

// TCP sockets the SWF opens are tunnelled through this WebSocket bridge.
startSocketProxy();
