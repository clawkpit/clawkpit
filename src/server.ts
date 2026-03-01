import { createServer } from "node:http";
import { migrate } from "./db/prisma";
import { createApp } from "./app";
import { WebSocketServer, type WebSocket } from "ws";
import { getUserFromSession } from "./services/authService";
import { registerSocket, unregisterSocket } from "./services/boardBroadcast";

function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/\bsession=([^;\s]+)/);
  return match ? match[1].trim() : null;
}

migrate();
const app = createApp();
const port = Number(process.env.PORT ?? 3000);
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url !== "/api/ws") {
    socket.destroy();
    return;
  }
  const sessionId = parseSessionCookie(request.headers.cookie);
  getUserFromSession(sessionId ?? undefined).then((user) => {
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, request, user.id);
    });
  }).catch(() => {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  });
});

wss.on("connection", (ws: WebSocket, _request: unknown, userId: string) => {
  registerSocket(userId, ws);
  ws.on("error", () => unregisterSocket(userId, ws));
  ws.on("close", () => unregisterSocket(userId, ws));
});

httpServer.listen(port, () => console.log(`Clawkpit running on :${port}`));
