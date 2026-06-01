import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { migrate, prisma } from "../src/db/prisma";
import { clearRateLimits } from "../src/services/rateLimit";

migrate();
const app = createApp();

const PROTOCOL_VERSION = "2024-11-05";

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

async function login(email = "u@example.com") {
  const agent = request.agent(app);
  const req = await agent.post("/api/auth/request-link").send({ email });
  await agent.post("/api/auth/consume-link").send({ token: req.body.token });
  return agent;
}

async function createApiKey(agent: request.SuperAgentTest) {
  const keyRes = await agent.post("/api/me/keys").send({ name: "mcp-test" });
  return keyRes.body.key as string;
}

function mcpPost(apiKey: string | undefined, body: unknown) {
  const req = request(app).post("/mcp").set("Accept", "application/json, text/event-stream");
  if (apiKey) req.set("Authorization", `Bearer ${apiKey}`);
  return req.send(body);
}

function parseMcpJson(res: request.Response): Record<string, unknown> {
  const text = typeof res.text === "string" ? res.text : JSON.stringify(res.body);
  if (text.trim().startsWith("{")) return JSON.parse(text) as Record<string, unknown>;
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  if (dataLine) return JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
  return res.body as Record<string, unknown>;
}

async function mcpInitialize(apiKey: string) {
  const initRes = await mcpPost(apiKey, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    },
  });
  return { initRes, initBody: parseMcpJson(initRes) };
}

async function mcpToolsCall(apiKey: string, name: string, args: Record<string, unknown>, id = 2) {
  const res = await mcpPost(apiKey, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  return { res, body: parseMcpJson(res) };
}

describe("Clawkpit MCP", () => {
  beforeEach(async () => {
    await resetDb();
    clearRateLimits();
  });

  it("requires authentication", async () => {
    const res = await mcpPost(undefined, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/API key/i);
  });

  it("rejects invalid API key", async () => {
    const res = await mcpPost("not-a-valid-key", {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(res.status).toBe(401);
  });

  it("initializes with a valid API key", async () => {
    const agent = await login();
    const apiKey = await createApiKey(agent);
    const { initRes, initBody } = await mcpInitialize(apiKey);
    expect(initRes.status).toBeLessThan(500);
    expect(initBody.result ?? initBody).toBeDefined();
    const result = (initBody.result ?? initBody) as Record<string, unknown>;
    expect(result.protocolVersion ?? result.serverInfo).toBeDefined();
  });

  it("validates create_task input", async () => {
    const agent = await login();
    const apiKey = await createApiKey(agent);
    await mcpInitialize(apiKey);

    const { res, body } = await mcpToolsCall(apiKey, "create_task", { title: "missing assignee" });
    expect(res.status).toBeLessThan(500);
    const result = body.result as Record<string, unknown> | undefined;
    const content = (result?.content as Array<{ text?: string }>) ?? [];
    const text = content.map((c) => c.text ?? "").join("");
    expect(text.toLowerCase()).toMatch(/assign|validation|required|error/i);
  });

  it("create_task creates an item visible via REST", async () => {
    const agent = await login();
    const apiKey = await createApiKey(agent);
    await mcpInitialize(apiKey);

    const { body } = await mcpToolsCall(apiKey, "create_task", {
      title: "MCP task",
      assigned_to: "AI",
      tag: "ToDo",
    });
    const result = body.result as Record<string, unknown>;
    const content = result.content as Array<{ text: string }>;
    const parsed = JSON.parse(content[0].text) as { item: { id: string; title: string } };
    expect(parsed.item.title).toBe("MCP task");

    const list = await request(app)
      .get("/api/v1/items?status=Active")
      .set("Authorization", `Bearer ${apiKey}`);
    expect(list.body.items.some((i: { id: string }) => i.id === parsed.item.id)).toBe(true);
  });

  it("isolates ownership on update_task", async () => {
    const agentA = await login("a@example.com");
    const keyA = await createApiKey(agentA);
    await mcpInitialize(keyA);
    const created = await mcpToolsCall(keyA, "create_task", {
      title: "A task",
      assigned_to: "AI",
    });
    const createdBody = created.body.result as Record<string, unknown>;
    const itemId = JSON.parse((createdBody.content as Array<{ text: string }>)[0].text).item.id;

    const agentB = await login("b@example.com");
    const keyB = await createApiKey(agentB);
    await mcpInitialize(keyB);
    const { body } = await mcpToolsCall(keyB, "update_task", {
      item_id: itemId,
      title: "Hijacked",
    });
    const result = body.result as Record<string, unknown>;
    expect(result.isError ?? JSON.parse((result.content as Array<{ text: string }>)[0].text)).toBeTruthy();
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text.toLowerCase()).toMatch(/not found|error/i);
  });

  it("does not leak stack traces for invalid UUID", async () => {
    const agent = await login();
    const apiKey = await createApiKey(agent);
    await mcpInitialize(apiKey);
    const { res, body } = await mcpToolsCall(apiKey, "complete_task", {
      item_id: "not-a-uuid",
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/at\s+\w+\s+\(/);
    expect(res.status).toBeLessThan(500);
  });
});
