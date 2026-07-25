import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { migrate, prisma } from "../src/db/prisma";
import { createKey } from "../src/services/apiKeyService";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(__dirname, "../cli/dist/index.js");

migrate();

async function resetDb() {
  await prisma.note.deleteMany();
  await prisma.formResponse.deleteMany();
  await prisma.item.deleteMany();
  await prisma.project.deleteMany();
  await prisma.agentContent.deleteMany();
  await prisma.userCounter.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.openclawDevice.deleteMany();
  await prisma.emailChangeRequest.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

async function runCli(
  args: string[],
  env: Record<string, string>
): Promise<{ code: number; json: Record<string, unknown>; stdout: string }> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], {
      env: { ...process.env, ...env },
      timeout: 15000,
    });
    const lines = stdout
      .trim()
      .split("\n")
      .filter(Boolean);
    const last = lines[lines.length - 1] ?? "{}";
    return { code: 0, json: JSON.parse(last) as Record<string, unknown>, stdout };
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    const stdout = err.stdout ?? "";
    const lines = stdout
      .trim()
      .split("\n")
      .filter(Boolean);
    const last = lines[lines.length - 1] ?? "{}";
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(last) as Record<string, unknown>;
    } catch {
      json = { raw: stdout, stderr: err.stderr };
    }
    return { code: typeof err.code === "number" ? err.code : 1, json, stdout };
  }
}

describe("clawkpit CLI integration", () => {
  let baseUrl = "";
  let apiToken = "";
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("No listen address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(async () => {
    await resetDb();
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: "cli@example.com",
        createdAt: now,
        updatedAt: now,
      },
    });
    const { key } = await createKey(user.id, "cli-test");
    apiToken = key;
  });

  it("create-task, list-tasks, get-next-action, complete-task", async () => {
    const env = {
      CLAWKPIT_BASE_URL: baseUrl,
      CLAWKPIT_API_TOKEN: apiToken,
      CLAWKPIT_CONFIG: path.join("/tmp", `clawkpit-cli-test-${process.pid}.json`),
    };

    const created = await runCli(
      ["create-task", "--title", "CLI task", "--assigned-to", "AI", "--tag", "ToDo", "--urgency", "DoNow"],
      env
    );
    expect(created.code).toBe(0);
    expect(created.json.ok).toBe(true);
    const item = created.json.item as { id: string; title: string; assignedTo: string };
    expect(item.title).toBe("CLI task");
    expect(item.assignedTo).toBe("AI");

    const listed = await runCli(["list-tasks", "--assigned-to", "AI", "--status", "Active"], env);
    expect(listed.code).toBe(0);
    expect(listed.json.ok).toBe(true);
    expect((listed.json.items as unknown[]).length).toBe(1);

    const next = await runCli(["get-next-action", "--assignee", "AI"], env);
    expect(next.code).toBe(0);
    expect((next.json.item as { id: string }).id).toBe(item.id);

    const done = await runCli(["complete-task", "--item-id", item.id], env);
    expect(done.code).toBe(0);
    expect((done.json.item as { status: string }).status).toBe("Done");
  });

  it("create-reminder, create-reading-item, send-user-message, and --json", async () => {
    const env = {
      CLAWKPIT_BASE_URL: baseUrl,
      CLAWKPIT_API_TOKEN: apiToken,
      CLAWKPIT_CONFIG: path.join("/tmp", `clawkpit-cli-test-json-${process.pid}.json`),
    };

    const deadline = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    const reminder = await runCli(
      ["create-reminder", "--title", "Call dentist", "--deadline", deadline],
      env
    );
    expect(reminder.code).toBe(0);
    expect((reminder.json.item as { assignedTo: string }).assignedTo).toBe("User");

    const reading = await runCli(
      ["create-reading-item", "--json", JSON.stringify({ title: "Memo", markdown: "# Memo\n\nHi" })],
      env
    );
    expect(reading.code).toBe(0);
    expect(reading.json.markdown_id).toBeTruthy();
    expect(reading.json.item_id).toBeTruthy();

    const msg = await runCli(
      ["send-user-message", "--message", "Please review", "--title", "Agent note"],
      env
    );
    expect(msg.code).toBe(0);
    expect((msg.json.item as { title: string }).title).toBe("Agent note");

    const snake = await runCli(
      ["create_task", "--json", JSON.stringify({ title: "Snake alias", assigned_to: "User" })],
      env
    );
    expect(snake.code).toBe(0);
    expect((snake.json.item as { title: string }).title).toBe("Snake alias");
  });

  it("returns JSON error when unauthenticated", async () => {
    const env = {
      CLAWKPIT_BASE_URL: baseUrl,
      CLAWKPIT_API_TOKEN: "",
      CLAWKPIT_API_KEY: "",
      CLAWKPIT_CONFIG: path.join("/tmp", `clawkpit-cli-test-unauth-${process.pid}.json`),
    };
    const res = await runCli(["status"], env);
    expect(res.code).not.toBe(0);
    expect(res.json.ok).toBe(false);
  });
});
