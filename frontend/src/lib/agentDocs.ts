/** Session flag: show connect-agent modal on board after first login with no API keys. */
export const SHOW_AGENT_CONNECT_AFTER_LOGIN = "clawkpit_show_agent_connect_after_login";
/** @deprecated Read and cleared alongside the current key. */
export const SHOW_AGENT_CONNECT_AFTER_LOGIN_LEGACY = "clawkpit_show_openclaw_after_login";

export function markShowAgentConnectAfterLogin(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SHOW_AGENT_CONNECT_AFTER_LOGIN, "1");
}

export function peekShowAgentConnectAfterLogin(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    sessionStorage.getItem(SHOW_AGENT_CONNECT_AFTER_LOGIN) ||
    sessionStorage.getItem(SHOW_AGENT_CONNECT_AFTER_LOGIN_LEGACY)
  );
}

export function clearShowAgentConnectAfterLogin(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SHOW_AGENT_CONNECT_AFTER_LOGIN);
  sessionStorage.removeItem(SHOW_AGENT_CONNECT_AFTER_LOGIN_LEGACY);
}

function docsBaseFromEnv(): string | undefined {
  if (typeof import.meta === "undefined") return undefined;
  const raw = import.meta.env.VITE_AGENT_DOCS_URL || import.meta.env.VITE_OPENCLAW_DOCS_URL;
  return typeof raw === "string" ? raw.trim() : undefined;
}

/** Normalize to origin only; allow http(s). Rejects javascript:, path tricks, trailing slashes. */
export function normalizeDocsBaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

/** Base URL for public agent skill docs (agent.md). Falls back to appBaseUrl. */
export function getAgentDocsBaseUrl(appBaseUrl: string): string {
  const fromEnv = docsBaseFromEnv();
  if (fromEnv) {
    const normalized = normalizeDocsBaseUrl(fromEnv);
    if (normalized) return normalized;
  }
  const fallback = appBaseUrl.trim() || (typeof window !== "undefined" ? window.location.origin : "");
  return normalizeDocsBaseUrl(fallback) || fallback.replace(/\/+$/, "");
}

export function agentDocsUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

export const AGENT_SKILL_INSTALL_COMMAND = (docsBase: string) =>
  `Open ${agentDocsUrl(docsBase, "agent.md")} and follow the steps to install the Clawkpit skill.`;
