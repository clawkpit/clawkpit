import { AsyncLocalStorage } from "node:async_hooks";
import { consumeRateLimit } from "../services/rateLimit";

export type McpContext = {
  userId: string;
  email: string;
};

export const mcpStorage = new AsyncLocalStorage<McpContext>();

export function getMcpContext(): McpContext {
  const ctx = mcpStorage.getStore();
  if (!ctx) throw new Error("MCP context missing");
  return ctx;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const MCP_RATE_LIMIT = parsePositiveInt(process.env.MCP_RATE_LIMIT, 120);
const MCP_RATE_WINDOW_MS = parsePositiveInt(process.env.MCP_RATE_WINDOW_MS, 60_000);

export function checkMcpRateLimit(userId: string): { allowed: boolean; retryAfterSec: number } {
  return consumeRateLimit(`mcp:${userId}`, MCP_RATE_LIMIT, MCP_RATE_WINDOW_MS);
}

export function auditMcpTool(
  toolName: string,
  userId: string,
  meta: { itemId?: string; formId?: string },
  durationMs: number
): void {
  console.info("[mcp]", {
    tool: toolName,
    userId,
    itemId: meta.itemId,
    formId: meta.formId,
    durationMs,
  });
}
