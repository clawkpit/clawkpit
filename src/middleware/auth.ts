import type { Request } from "express";
import { getUserByKey } from "../services/apiKeyService";
import { getUserFromSession } from "../services/authService";

export type AuthUser = { id: string; email: string };
export type AuthVia = "apikey" | "session";

export function extractApiToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string") {
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer) return bearer;
  }
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.trim()) return apiKey.trim();
  return undefined;
}

export async function resolveAuth(req: Request): Promise<{ user: AuthUser; authVia: AuthVia } | null> {
  const token = extractApiToken(req);
  if (token) {
    const user = await getUserByKey(token);
    if (user) return { user, authVia: "apikey" };
  }
  const user = await getUserFromSession(req.cookies?.session);
  if (user) return { user, authVia: "session" };
  return null;
}

/** MCP accepts API keys only (no browser session cookies). */
export async function resolveApiKeyUser(req: Request): Promise<AuthUser | null> {
  const token = extractApiToken(req);
  if (!token) return null;
  return getUserByKey(token);
}
