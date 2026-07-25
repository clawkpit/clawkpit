export type CliErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type CliOkBody<T = unknown> = {
  ok: true;
} & T;

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function fail(code: string, message: string, details?: unknown, exitCode = 1): never {
  printJson({
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  } satisfies CliErrorBody);
  process.exit(exitCode);
}

export function ok<T extends Record<string, unknown>>(payload: T): never {
  printJson({ ok: true, ...payload } satisfies CliOkBody<T>);
  process.exit(0);
}
