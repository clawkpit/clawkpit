#!/usr/bin/env node
import { parseArgs } from "./args.js";
import { runCommand } from "./commands.js";
import { fail } from "./output.js";

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    await runCommand(parsed);
  } catch (e) {
    if (e instanceof SyntaxError) {
      fail("BAD_REQUEST", `Invalid JSON: ${e.message}`);
    }
    if (e instanceof Error) {
      fail("CLI_ERROR", e.message);
    }
    fail("CLI_ERROR", "Unknown error");
  }
}

void main();
