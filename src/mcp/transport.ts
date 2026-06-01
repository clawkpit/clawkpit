import type { Express, Request, Response } from "express";
import { resolveApiKeyUser } from "../middleware/auth";
import { createMcpServer } from "./server";
import { auditMcpTool, checkMcpRateLimit, mcpStorage } from "./context";

const MCP_ENABLED = process.env.MCP_ENABLED !== "false";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function allowedMcpHosts(): string[] {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "[::1]"]);
  const base = process.env.APP_BASE_URL?.trim();
  if (base) {
    try {
      hosts.add(new URL(base).hostname);
    } catch {
      /* ignore invalid APP_BASE_URL */
    }
  }
  const extra = process.env.MCP_ALLOWED_HOSTS?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const h = part.trim().toLowerCase();
      if (h) hosts.add(h);
    }
  }
  return [...hosts];
}

function hasMcpHostAllowlist(): boolean {
  if (process.env.MCP_ALLOWED_HOSTS?.trim()) return true;
  const base = process.env.APP_BASE_URL?.trim();
  if (!base) return false;
  try {
    new URL(base);
    return true;
  } catch {
    return false;
  }
}

function shouldEnforceMcpHostGuard(): boolean {
  if (!IS_PRODUCTION) return false;
  if (process.env.MCP_HOST_GUARD === "false") return false;
  if (process.env.MCP_HOST_GUARD === "true") return true;
  return hasMcpHostAllowlist();
}

function isToolsCall(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return (body as { method?: string }).method === "tools/call";
}

function parseJsonRpcMethod(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  return typeof (body as { method?: string }).method === "string"
    ? (body as { method: string }).method
    : undefined;
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  if (!MCP_ENABLED) {
    res.status(503).json({ error: "MCP endpoint is disabled on this server." });
    return;
  }

  const user = await resolveApiKeyUser(req);
  if (!user) {
    res.status(401).json({
      error:
        "Unauthorized. MCP requires an API key via Authorization: Bearer <key> or X-API-Key. Obtain a key via OpenClaw device flow or Clawkpit Settings.",
    });
    return;
  }

  if (isToolsCall(req.body)) {
    const rate = checkMcpRateLimit(user.id);
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSec));
      res.status(429).json({ error: "MCP rate limit exceeded. Try again later." });
      return;
    }
  }

  const { NodeStreamableHTTPServerTransport } = await import("@modelcontextprotocol/node");

  await mcpStorage.run({ userId: user.id, email: user.email }, async () => {
    const server = await createMcpServer();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      const method = parseJsonRpcMethod(req.body);
      if (method === "tools/call") {
        auditMcpTool("transport_error", user.id, {}, 0);
      }
      if (!res.headersSent) {
        const message =
          process.env.NODE_ENV === "production"
            ? "MCP request failed."
            : e instanceof Error
              ? e.message
              : "MCP request failed.";
        res.status(500).json({ error: message });
      }
    } finally {
      try {
        await server.close();
      } catch {
        /* ignore close errors */
      }
    }
  });
}

function productionHostGuard(req: Request, res: Response, next: () => void): void {
  const raw = req.headers.host;
  if (!raw) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const hostname = raw.split(":")[0]?.toLowerCase();
  const allowed = allowedMcpHosts().map((h) => h.toLowerCase());
  if (!hostname || !allowed.includes(hostname)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function mountMcp(app: Express): void {
  const hostMiddleware = shouldEnforceMcpHostGuard()
    ? productionHostGuard
    : (_req: Request, _res: Response, next: () => void) => next();

  app.get("/mcp", hostMiddleware, (req, res) => {
    void handleMcpRequest(req, res);
  });
  app.post("/mcp", hostMiddleware, (req, res) => {
    void handleMcpRequest(req, res);
  });
}
