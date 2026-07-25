import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_BASE_URL = "https://app.clawkpit.com";

export type CliConfig = {
  baseUrl?: string;
  apiToken?: string;
};

function xdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
}

export function defaultConfigPath(): string {
  if (process.env.CLAWKPIT_CONFIG?.trim()) return process.env.CLAWKPIT_CONFIG.trim();
  return join(xdgConfigHome(), "clawkpit", "config.json");
}

export function loadConfig(path = defaultConfigPath()): CliConfig {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as CliConfig;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : undefined,
      apiToken: typeof parsed.apiToken === "string" ? parsed.apiToken : undefined,
    };
  } catch {
    return {};
  }
}

export function saveConfig(config: CliConfig, path = defaultConfigPath()): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const existing = loadConfig(path);
  const next: CliConfig = {
    ...existing,
    ...config,
  };
  // Drop empty fields
  if (!next.baseUrl) delete next.baseUrl;
  if (!next.apiToken) delete next.apiToken;
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

export function clearConfigToken(path = defaultConfigPath()): void {
  const existing = loadConfig(path);
  delete existing.apiToken;
  if (!existing.baseUrl) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`, { mode: 0o600 });
}

export function resolveBaseUrl(config: CliConfig = loadConfig()): string {
  const fromEnv = process.env.CLAWKPIT_BASE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);
  if (config.baseUrl?.trim()) return stripTrailingSlash(config.baseUrl.trim());
  return DEFAULT_BASE_URL;
}

export function resolveApiToken(config: CliConfig = loadConfig()): string | undefined {
  const fromEnv =
    process.env.CLAWKPIT_API_TOKEN?.trim() ||
    process.env.CLAWKPIT_API_KEY?.trim() ||
    undefined;
  if (fromEnv) return fromEnv;
  return config.apiToken?.trim() || undefined;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
