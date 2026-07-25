export type ParsedArgs = {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
  json: Record<string, unknown> | undefined;
  help: boolean;
};

function kebabToSnake(key: string): string {
  return key.replace(/-/g, "_");
}

function parseValue(raw: string): string | boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  return raw;
}

/**
 * Parse argv into command, positionals, and flags.
 * Supports `--key value`, `--key=value`, `--bool`, and `--json '{...}'`.
 * Flag keys are normalized to snake_case (MCP param names).
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command: string | undefined;
  let json: Record<string, unknown> | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--json") {
      const next = argv[++i];
      if (next === undefined) throw new Error("Missing value for --json");
      json = JSON.parse(next) as Record<string, unknown>;
      continue;
    }

    if (arg.startsWith("--json=")) {
      json = JSON.parse(arg.slice("--json=".length)) as Record<string, unknown>;
      continue;
    }

    if (arg.startsWith("--")) {
      let key: string;
      let value: string | boolean | null;

      const eq = arg.indexOf("=");
      if (eq !== -1) {
        key = arg.slice(2, eq);
        value = parseValue(arg.slice(eq + 1));
      } else {
        key = arg.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          value = parseValue(next);
          i++;
        } else {
          value = true;
        }
      }

      const snake = kebabToSnake(key);
      if (value === null) {
        flags[snake] = "null";
      } else if (typeof value === "boolean") {
        flags[snake] = value;
      } else {
        flags[snake] = value;
      }
      continue;
    }

    if (!command) {
      command = arg;
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags, json, help };
}

export function mergeInputs(
  flags: Record<string, string | boolean>,
  json: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(json ?? {}) };
  for (const [key, value] of Object.entries(flags)) {
    if (value === "null") {
      out[key] = null;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function asBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return defaultValue;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function requireString(
  inputs: Record<string, unknown>,
  key: string
): string {
  const v = asString(inputs[key]);
  if (!v || !v.trim()) {
    throw new Error(`Missing required argument: --${key.replace(/_/g, "-")}`);
  }
  return v;
}
