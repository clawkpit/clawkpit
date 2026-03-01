import { WebSocket } from "ws";

/** Per-user set of open WebSocket connections (board subscribers). */
const userSockets = new Map<string, Set<WebSocket>>();

export function registerSocket(userId: string, ws: WebSocket): void {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
}

export function unregisterSocket(userId: string, ws: WebSocket): void {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

export type BoardEvent = { type: "items:changed" };

/**
 * Send an event to every open WebSocket for a given user.
 * Stale/closed sockets are pruned automatically.
 */
export function broadcastToUser(userId: string, data: BoardEvent): void {
  const set = userSockets.get(userId);
  if (!set) return;
  const payload = JSON.stringify(data);
  const stale: WebSocket[] = [];
  for (const ws of set) {
    if (ws.readyState !== WebSocket.OPEN) {
      stale.push(ws);
      continue;
    }
    try {
      ws.send(payload);
    } catch {
      stale.push(ws);
    }
  }
  for (const ws of stale) {
    set.delete(ws);
  }
  if (set.size === 0) userSockets.delete(userId);
}
