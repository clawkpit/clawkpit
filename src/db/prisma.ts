import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(
  process.env.NODE_ENV === "development"
    ? { log: ["error", "warn"] }
    : undefined
);

export { prisma };

/** In dev, run pending SQLite migrations so the app can start without manual migrate. In production, migrations are run via CLI (db:migrate:deploy) before/after deploy. */
export function migrate(): void {
  if (process.env.NODE_ENV === "production") return;
  const { execFileSync } = require("node:child_process");
  const path = require("node:path");
  const schemaPath = path.join(process.cwd(), "prisma", "schema.sqlite.prisma");
  execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", schemaPath], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}
