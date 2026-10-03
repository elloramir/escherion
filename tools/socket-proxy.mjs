import net from "node:net";
import { WebSocketServer } from "ws";

// WebSocket -> TCP bridge for flash.net.Socket. The page cannot open raw TCP, so
// a Socket connects here with the real target in the query string and every byte
// is forwarded to that server (e.g. sock7.aq.com:5592).
export function startSocketProxy(port = Number(process.env.SOCKET_PORT ?? 8181)) {
    const server = new WebSocketServer({ port });
    server.on("connection", (client, request) => {
        let target;
        try {
            target = new URL(request.url, "ws://localhost");
        } catch {
            client.close();
            return;
        }
        const host = target.searchParams.get("host");
        const destPort = Number(target.searchParams.get("port"));
        if (!host || !Number.isFinite(destPort)) {
            client.close();
            return;
        }

        const socket = net.connect({ host, port: destPort });
        let open = false;
        const pending = [];
        socket.on("connect", () => {
            open = true;
            for (const chunk of pending) socket.write(chunk);
            pending.length = 0;
        });
        socket.on("data", (chunk) => {
            if (client.readyState === client.OPEN) client.send(chunk);
        });
        socket.on("error", () => client.close());
        socket.on("close", () => client.close());
        client.on("message", (data) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
            if (open) socket.write(chunk);
            else pending.push(chunk);
        });
        client.on("close", () => socket.destroy());
        client.on("error", () => socket.destroy());
    });
    server.on("listening", () => console.log(`socket proxy on ws://localhost:${port} (tcp bridge)`));
    return server;
}

// Allow running it on its own: `node tools/socket-proxy.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) startSocketProxy();
