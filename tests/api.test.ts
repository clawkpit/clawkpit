import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { migrate, prisma } from "../src/db/prisma";
import { requestEmailChange } from "../src/services/authService";
import { clearRateLimits } from "../src/services/rateLimit";

migrate();
const app = createApp();

async function resetDb() {
  await prisma.note.deleteMany();
  await prisma.formResponse.deleteMany();
  await prisma.item.deleteMany();
  await prisma.agentContent.deleteMany();
  await prisma.userCounter.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.openclawDevice.deleteMany();
  await prisma.emailChangeRequest.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

async function reset() {
  await resetDb();
  clearRateLimits();
}

async function login(email = "u@example.com") {
  const agent = request.agent(app);
  const req = await agent.post("/api/auth/request-link").send({ email });
  await agent.post("/api/auth/consume-link").send({ token: req.body.token });
  return agent;
}

describe("Clawkpit API", () => {
  beforeEach(async () => {
    await reset();
  });

  it("sorts by deadline, then importance, then updatedAt desc", async () => {
    const agent = await login();
    await agent.post("/api/v1/items").send({ title: "late no deadline", importance: "Low", deadline: null });
    await agent.post("/api/v1/items").send({ title: "high soon", importance: "High", deadline: "2026-02-18T10:00:00.000Z" });
    await agent.post("/api/v1/items").send({ title: "medium soon", importance: "Medium", deadline: "2026-02-18T10:00:00.000Z" });
    const list = await agent.get("/api/v1/items?status=Active");
    expect(list.body.items.map((i: any) => i.title)).toEqual(["high soon", "medium soon", "late no deadline"]);
  });

  it("blocks done for ToThinkAbout without note", async () => {
    const agent = await login();
    const created = await agent.post("/api/v1/items").send({ title: "Reflect", tag: "ToThinkAbout" });
    const done = await agent.post(`/api/v1/items/${created.body.id}/done`).send({ actor: "User" });
    expect(done.status).toBe(400);
    expect(done.body.error).toBeDefined();
    expect(done.body.error.code).toBe("BAD_REQUEST");
    expect(done.body.error.message).toMatch(/reflection/);
  });

  it("requires note on drop", async () => {
    const agent = await login();
    const created = await agent.post("/api/v1/items").send({ title: "Drop me" });
    const dropped = await agent.post(`/api/v1/items/${created.body.id}/drop`).send({ actor: "User" });
    expect(dropped.status).toBe(400);
    expect(dropped.body.error).toBeDefined();
    expect(dropped.body.error.code).toBe("BAD_REQUEST");
    expect(dropped.body.error.message).toBeDefined();
  });

  it("prevents AI from editing notes", async () => {
    const agent = await login();
    const created = await agent.post("/api/v1/items").send({ title: "n" });
    const note = await agent.post(`/api/v1/items/${created.body.id}/notes`).send({ author: "AI", content: "x" });
    const edit = await agent.patch(`/api/v1/notes/${note.body.noteId}`).send({ actor: "AI", content: "y" });
    expect(edit.status).toBe(403);
    expect(edit.body.error).toBeDefined();
    expect(edit.body.error.code).toBe("FORBIDDEN");
    expect(edit.body.error.message).toMatch(/AI cannot edit/);
  });

  it("supports logout and invalidates the current session", async () => {
    const agent = await login();
    const meBefore = await agent.get("/api/me");
    expect(meBefore.status).toBe(200);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const meAfter = await agent.get("/api/me");
    expect(meAfter.status).toBe(401);
    expect(meAfter.body.error).toBeDefined();
    expect(meAfter.body.error.code).toBe("UNAUTHORIZED");
    expect(meAfter.body.error.message).toBeDefined();
  });

  it("rate limits magic-link requests", async () => {
    for (let i = 0; i < 5; i++) {
      const ok = await request(app).post("/api/auth/request-link").send({ email: "limit@example.com" });
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app).post("/api/auth/request-link").send({ email: "limit@example.com" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeTruthy();
    expect(blocked.body.error).toBeDefined();
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.body.error.message).toBeDefined();
  });

  it("returns error envelope with code and message for failures", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
    expect(res.body.error).toHaveProperty("message");
    expect(typeof res.body.error.message).toBe("string");
    expect(res.body.error).toHaveProperty("details");
    expect(typeof res.body.error.details).toBe("object");
  });

  describe("cross-user scoping", () => {
    it("user B cannot read or modify user A's items (session)", async () => {
      const agentA = await login("user-a@example.com");
      const agentB = await login("user-b@example.com");

      const created = await agentA.post("/api/v1/items").send({ title: "A's item" });
      const itemId = created.body.id;
      const noteRes = await agentA.post(`/api/v1/items/${itemId}/notes`).send({ author: "User", content: "A's note" });
      const noteId = noteRes.body.noteId;

      const getItem = await agentB.get(`/api/v1/items/${itemId}`);
      expect(getItem.status).toBe(404);
      expect(getItem.body.error?.code).toBe("NOT_FOUND");

      const patchItem = await agentB.patch(`/api/v1/items/${itemId}`).send({ title: "Hacked" });
      expect(patchItem.status).toBe(404);
      expect(patchItem.body.error?.code).toBe("NOT_FOUND");

      const getNotes = await agentB.get(`/api/v1/items/${itemId}/notes`);
      expect(getNotes.status).toBe(404);
      expect(getNotes.body.error?.code).toBe("NOT_FOUND");

      const addNote = await agentB.post(`/api/v1/items/${itemId}/notes`).send({ author: "User", content: "B's note" });
      expect(addNote.status).toBe(404);
      expect(addNote.body.error?.code).toBe("NOT_FOUND");

      const patchNote = await agentB.patch(`/api/v1/notes/${noteId}`).send({ actor: "User", content: "Hacked note" });
      expect(patchNote.status).toBe(404);
      expect(patchNote.body.error?.code).toBe("NOT_FOUND");

      const done = await agentB.post(`/api/v1/items/${itemId}/done`).send({ actor: "User" });
      expect(done.status).toBe(404);
      expect(done.body.error?.code).toBe("NOT_FOUND");

      const drop = await agentB.post(`/api/v1/items/${itemId}/drop`).send({ actor: "User", note: "dropping" });
      expect(drop.status).toBe(404);
      expect(drop.body.error?.code).toBe("NOT_FOUND");
    });

    it("user B cannot read user A's item when using API key", async () => {
      const agentA = await login("user-a@example.com");
      const agentB = await login("user-b@example.com");

      const created = await agentA.post("/api/v1/items").send({ title: "A's item" });
      const itemId = created.body.id;

      const keyRes = await agentB.post("/api/me/keys").send({});
      const apiKey = keyRes.body.key;
      expect(keyRes.status).toBe(201);
      expect(apiKey).toBeTruthy();

      const getItem = await request(app)
        .get(`/api/v1/items/${itemId}`)
        .set("Authorization", `Bearer ${apiKey}`);
      expect(getItem.status).toBe(404);
      expect(getItem.body.error?.code).toBe("NOT_FOUND");

      const patchItem = await request(app)
        .patch(`/api/v1/items/${itemId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ title: "Hacked" });
      expect(patchItem.status).toBe(404);
      expect(patchItem.body.error?.code).toBe("NOT_FOUND");
    });

    it("user B does not see user A's items in list", async () => {
      const agentA = await login("user-a@example.com");
      const agentB = await login("user-b@example.com");

      await agentA.post("/api/v1/items").send({ title: "A's item" });
      const listB = await agentB.get("/api/v1/items?status=Active");
      expect(listB.status).toBe(200);
      expect(listB.body.items).toHaveLength(0);
    });
  });

  describe("list items pagination and filters", () => {
    it("paginates by page and pageSize", async () => {
      const agent = await login();
      await agent.post("/api/v1/items").send({ title: "1" });
      await agent.post("/api/v1/items").send({ title: "2" });
      await agent.post("/api/v1/items").send({ title: "3" });
      await agent.post("/api/v1/items").send({ title: "4" });
      await agent.post("/api/v1/items").send({ title: "5" });

      const page1 = await agent.get("/api/v1/items?status=Active&page=1&pageSize=2");
      expect(page1.status).toBe(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.total).toBe(5);
      expect(page1.body.page).toBe(1);
      expect(page1.body.pageSize).toBe(2);

      const page2 = await agent.get("/api/v1/items?status=Active&page=2&pageSize=2");
      expect(page2.status).toBe(200);
      expect(page2.body.items).toHaveLength(2);
      expect(page2.body.total).toBe(5);

      const page3 = await agent.get("/api/v1/items?status=Active&page=3&pageSize=2");
      expect(page3.status).toBe(200);
      expect(page3.body.items).toHaveLength(1);
      expect(page3.body.total).toBe(5);

      const allTitles = [
        ...page1.body.items,
        ...page2.body.items,
        ...page3.body.items,
      ].map((i: any) => i.title).sort();
      expect(allTitles).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("filters by status Done and Dropped", async () => {
      const agent = await login();
      const a = await agent.post("/api/v1/items").send({ title: "Active one" });
      const b = await agent.post("/api/v1/items").send({ title: "To done", tag: "ToDo" });
      const c = await agent.post("/api/v1/items").send({ title: "To drop" });

      await agent.post(`/api/v1/items/${b.body.id}/done`).send({ actor: "User" });
      await agent.post(`/api/v1/items/${c.body.id}/notes`).send({ author: "User", content: "why" });
      await agent.post(`/api/v1/items/${c.body.id}/drop`).send({ actor: "User", note: "dropping" });

      const active = await agent.get("/api/v1/items?status=Active");
      expect(active.status).toBe(200);
      expect(active.body.items.map((i: any) => i.title)).toEqual(["Active one"]);

      const done = await agent.get("/api/v1/items?status=Done");
      expect(done.status).toBe(200);
      expect(done.body.items.map((i: any) => i.title)).toEqual(["To done"]);

      const dropped = await agent.get("/api/v1/items?status=Dropped");
      expect(dropped.status).toBe(200);
      expect(dropped.body.items.map((i: any) => i.title)).toEqual(["To drop"]);

      const all = await agent.get("/api/v1/items?status=All");
      expect(all.status).toBe(200);
      expect(all.body.items).toHaveLength(3);
    });

    it("filters by deadlineBefore and deadlineAfter", async () => {
      const agent = await login();
      await agent.post("/api/v1/items").send({ title: "Early", deadline: "2026-02-01T12:00:00.000Z" });
      await agent.post("/api/v1/items").send({ title: "Mid", deadline: "2026-02-15T12:00:00.000Z" });
      await agent.post("/api/v1/items").send({ title: "Late", deadline: "2026-02-28T12:00:00.000Z" });

      const before = await agent.get("/api/v1/items?status=Active&deadlineBefore=2026-02-20T00:00:00.000Z");
      expect(before.status).toBe(200);
      expect(before.body.items.map((i: any) => i.title).sort()).toEqual(["Early", "Mid"]);

      const after = await agent.get("/api/v1/items?status=Active&deadlineAfter=2026-02-10T00:00:00.000Z");
      expect(after.status).toBe(200);
      expect(after.body.items.map((i: any) => i.title).sort()).toEqual(["Late", "Mid"]);

      const range = await agent.get("/api/v1/items?status=Active&deadlineAfter=2026-02-10T00:00:00.000Z&deadlineBefore=2026-02-20T00:00:00.000Z");
      expect(range.status).toBe(200);
      expect(range.body.items.map((i: any) => i.title)).toEqual(["Mid"]);
    });

    it("filters by createdBy", async () => {
      const agent = await login();
      await agent.post("/api/v1/items").send({ title: "By user", createdBy: "User" });
      await agent.post("/api/v1/items").send({ title: "By AI", createdBy: "AI" });

      const byUser = await agent.get("/api/v1/items?status=Active&createdBy=User");
      expect(byUser.status).toBe(200);
      expect(byUser.body.items.map((i: any) => i.title)).toEqual(["By user"]);

      const byAI = await agent.get("/api/v1/items?status=Active&createdBy=AI");
      expect(byAI.status).toBe(200);
      expect(byAI.body.items.map((i: any) => i.title)).toEqual(["By AI"]);
    });

    it("filters by modifiedBy", async () => {
      const agent = await login();
      await agent.post("/api/v1/items").send({ title: "Only user" });
      await agent.post("/api/v1/items").send({ title: "Edited by AI" });
      const edited = await agent.post("/api/v1/items").send({ title: "Will be AI-edited" });
      await agent.patch(`/api/v1/items/${edited.body.id}`).send({ title: "AI edited", modifiedBy: "AI" });

      const byUser = await agent.get("/api/v1/items?status=Active&modifiedBy=User");
      expect(byUser.status).toBe(200);
      expect(byUser.body.items.map((i: any) => i.title).sort()).toEqual(["Edited by AI", "Only user"]);

      const byAI = await agent.get("/api/v1/items?status=Active&modifiedBy=AI");
      expect(byAI.status).toBe(200);
      expect(byAI.body.items.map((i: any) => i.title)).toEqual(["AI edited"]);
    });
  });

  describe("Agent content", () => {
    it("POST /api/agent/markdown creates content and ToRead item, GET returns markdown", async () => {
      const agent = await login();
      const push = await agent.post("/api/agent/markdown").send({
        title: "My doc",
        markdown: "# Hello\n\nThis is **markdown**.",
      });
      expect(push.status).toBe(201);
      expect(push.body.markdownId).toBeTruthy();
      expect(push.body.itemId).toBeTruthy();

      const getMd = await agent.get(`/api/markdown/${push.body.markdownId}`);
      expect(getMd.status).toBe(200);
      expect(getMd.body.title).toBe("My doc");
      expect(getMd.body.markdown).toContain("# Hello");
      expect(getMd.body.markdown).toContain("**markdown**");

      const getItem = await agent.get(`/api/v1/items/${push.body.itemId}`);
      expect(getItem.status).toBe(200);
      expect(getItem.body.tag).toBe("ToRead");
      expect(getItem.body.contentId).toBe(push.body.markdownId);
    });

    it("markdown idempotency: same externalId returns same markdownId and only one item", async () => {
      const agent = await login();
      const first = await agent.post("/api/agent/markdown").send({
        title: "Same",
        markdown: "# Same doc",
        externalId: "idem-1",
      });
      expect(first.status).toBe(201);
      const second = await agent.post("/api/agent/markdown").send({
        title: "Same",
        markdown: "# Same doc",
        externalId: "idem-1",
      });
      expect(second.status).toBe(201);
      expect(second.body.markdownId).toBe(first.body.markdownId);
      const list = await agent.get("/api/v1/items?status=Active&tag=ToRead");
      const toRead = list.body.items.filter((i: any) => i.contentId === first.body.markdownId);
      expect(toRead.length).toBe(1);
    });

    it("POST /api/agent/form creates form content and ToDo item, GET returns form", async () => {
      const agent = await login();
      const formMd = `# Survey
## Name [text]
- required: true
## Score [scale]
- min: 1
- max: 5
`;
      const push = await agent.post("/api/agent/form").send({
        title: "Survey",
        formMarkdown: formMd,
      });
      expect(push.status).toBe(201);
      expect(push.body.formId).toBeTruthy();
      expect(push.body.itemId).toBeTruthy();

      const getForm = await agent.get(`/api/forms/${push.body.formId}`);
      expect(getForm.status).toBe(200);
      expect(getForm.body.title).toBe("Survey");
      expect(getForm.body.formMarkdown).toContain("## Name [text]");

      const getItem = await agent.get(`/api/v1/items/${push.body.itemId}`);
      expect(getItem.status).toBe(200);
      expect(getItem.body.tag).toBe("ToDo");
      expect(getItem.body.contentId).toBe(push.body.formId);
    });

    it("POST /api/forms/:id/submit saves response and marks item Done", async () => {
      const agent = await login();
      const formMd = `# Quick
## Answer [text]
`;
      const push = await agent.post("/api/agent/form").send({ title: "Quick", formMarkdown: formMd });
      expect(push.status).toBe(201);
      const formId = push.body.formId;
      const itemId = push.body.itemId;

      const submit = await agent.post(`/api/forms/${formId}/submit`).send({
        itemId,
        response: { answer: "yes" },
      });
      expect(submit.status).toBe(201);
      expect(submit.body.id).toBeTruthy();

      const item = await agent.get(`/api/v1/items/${itemId}`);
      expect(item.status).toBe(200);
      expect(item.body.status).toBe("Done");

      const responses = await agent.get(`/api/agent/forms/${formId}/responses`);
      expect(responses.status).toBe(200);
      expect(responses.body.responses).toHaveLength(1);
      expect(responses.body.responses[0].response).toEqual({ answer: "yes" });
    });

    it("user B cannot access user A markdown (GET /api/markdown/:id)", async () => {
      const agentA = await login("a@example.com");
      const agentB = await login("b@example.com");

      const push = await agentA.post("/api/agent/markdown").send({
        title: "Secret",
        markdown: "# Secret",
      });
      expect(push.status).toBe(201);
      const markdownId = push.body.markdownId;

      const getB = await agentB.get(`/api/markdown/${markdownId}`);
      expect(getB.status).toBe(404);
      expect(getB.body.error?.code).toBe("NOT_FOUND");
    });

    it("user B cannot access user A form or submit (GET /api/forms/:id, POST submit)", async () => {
      const agentA = await login("a@example.com");
      const agentB = await login("b@example.com");

      const push = await agentA.post("/api/agent/form").send({
        title: "A form",
        formMarkdown: "# F\n## X [text]",
      });
      expect(push.status).toBe(201);
      const formId = push.body.formId;

      const getB = await agentB.get(`/api/forms/${formId}`);
      expect(getB.status).toBe(404);

      const submitB = await agentB.post(`/api/forms/${formId}/submit`).send({
        itemId: push.body.itemId,
        response: { x: "y" },
      });
      expect(submitB.status).toBe(404);
    });

    it("markdown contentHash dedup: same body without externalId returns same markdownId", async () => {
      const agent = await login();
      const md = "# Duplicate body\n\nSame content here.";
      const first = await agent.post("/api/agent/markdown").send({ markdown: md });
      expect(first.status).toBe(201);
      const second = await agent.post("/api/agent/markdown").send({ markdown: md });
      expect(second.status).toBe(201);
      expect(second.body.markdownId).toBe(first.body.markdownId);
      expect(second.body.itemId).toBe(first.body.itemId);
    });

    it("form idempotency: same externalId returns same formId and only one active item", async () => {
      const agent = await login();
      const formMd = "# Idem form\n## Name [text]\n- required: true\n";
      const first = await agent.post("/api/agent/form").send({
        title: "Idem",
        formMarkdown: formMd,
        externalId: "form-idem-1",
      });
      expect(first.status).toBe(201);
      const second = await agent.post("/api/agent/form").send({
        title: "Idem",
        formMarkdown: formMd,
        externalId: "form-idem-1",
      });
      expect(second.status).toBe(201);
      expect(second.body.formId).toBe(first.body.formId);
      const list = await agent.get("/api/v1/items?status=Active&tag=ToDo");
      const linked = list.body.items.filter((i: any) => i.contentId === first.body.formId);
      expect(linked.length).toBe(1);
    });

    it("submit form response against markdown content returns 400 NOT_A_FORM", async () => {
      const agent = await login();
      const push = await agent.post("/api/agent/markdown").send({
        title: "Not a form",
        markdown: "# Just markdown",
      });
      expect(push.status).toBe(201);
      const submit = await agent.post(`/api/forms/${push.body.markdownId}/submit`).send({
        response: { answer: "yes" },
      });
      expect(submit.status).toBe(400);
      expect(submit.body.error?.code).toBe("BAD_REQUEST");
    });

    it("agent markdown push returns contentType in item response", async () => {
      const agent = await login();
      const push = await agent.post("/api/agent/markdown").send({
        title: "Typed",
        markdown: "# Typed doc",
      });
      expect(push.status).toBe(201);
      const item = await agent.get(`/api/v1/items/${push.body.itemId}`);
      expect(item.status).toBe(200);
      expect(item.body.contentType).toBe("markdown");
    });

    it("agent form push returns contentType in item response", async () => {
      const agent = await login();
      const push = await agent.post("/api/agent/form").send({
        title: "Typed form",
        formMarkdown: "# TF\n## Q [text]\n",
      });
      expect(push.status).toBe(201);
      const item = await agent.get(`/api/v1/items/${push.body.itemId}`);
      expect(item.status).toBe(200);
      expect(item.body.contentType).toBe("form");
    });

    it("agent markdown push with empty body returns 400", async () => {
      const agent = await login();
      const res = await agent.post("/api/agent/markdown").send({
        title: "Empty",
        markdown: "",
      });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("BAD_REQUEST");
    });

    it("agent form push with empty body returns 400", async () => {
      const agent = await login();
      const res = await agent.post("/api/agent/form").send({
        title: "Empty",
        formMarkdown: "",
      });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("BAD_REQUEST");
    });
  });

  describe("hasAIChanges tracking", () => {
    it("is false when User creates an item", async () => {
      const agent = await login();
      const res = await agent.post("/api/v1/items").send({ title: "User item", createdBy: "User" });
      expect(res.status).toBe(201);
      expect(res.body.hasAIChanges).toBe(false);
    });

    it("is true when AI creates an item", async () => {
      const agent = await login();
      const res = await agent.post("/api/v1/items").send({ title: "AI item", createdBy: "AI" });
      expect(res.status).toBe(201);
      expect(res.body.hasAIChanges).toBe(true);
    });

    it("is set to true when AI patches an item", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "User item" });
      expect(created.body.hasAIChanges).toBe(false);

      const patched = await agent.patch(`/api/v1/items/${created.body.id}`).send({ title: "AI edit", modifiedBy: "AI" });
      expect(patched.status).toBe(200);
      expect(patched.body.hasAIChanges).toBe(true);
    });

    it("can be cleared via PATCH without bumping updatedAt", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "AI item", createdBy: "AI" });
      expect(created.body.hasAIChanges).toBe(true);
      const originalUpdatedAt = created.body.updatedAt;

      const cleared = await agent.patch(`/api/v1/items/${created.body.id}`).send({ hasAIChanges: false });
      expect(cleared.status).toBe(200);
      expect(cleared.body.hasAIChanges).toBe(false);
      expect(cleared.body.updatedAt).toBe(originalUpdatedAt);
    });

    it("is set to true when AI adds a note", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "Item" });
      expect(created.body.hasAIChanges).toBe(false);

      await agent.post(`/api/v1/items/${created.body.id}/notes`).send({ author: "AI", content: "AI note" });
      const item = await agent.get(`/api/v1/items/${created.body.id}`);
      expect(item.body.hasAIChanges).toBe(true);
    });

    it("stays false when User adds a note", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "Item" });
      expect(created.body.hasAIChanges).toBe(false);

      await agent.post(`/api/v1/items/${created.body.id}/notes`).send({ author: "User", content: "User note" });
      const item = await agent.get(`/api/v1/items/${created.body.id}`);
      expect(item.body.hasAIChanges).toBe(false);
    });

    it("is set to true when AI marks item done", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "Task", tag: "ToDo" });
      const done = await agent.post(`/api/v1/items/${created.body.id}/done`).send({ actor: "AI" });
      expect(done.status).toBe(200);
      expect(done.body.hasAIChanges).toBe(true);
    });

    it("is set to true when AI drops an item", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "To drop" });
      await agent.post(`/api/v1/items/${created.body.id}/notes`).send({ author: "User", content: "reason" });
      // Clear any flag from note (it was User note so should be false, but be explicit)
      await agent.patch(`/api/v1/items/${created.body.id}`).send({ hasAIChanges: false });

      const dropped = await agent.post(`/api/v1/items/${created.body.id}/drop`).send({ actor: "AI" });
      expect(dropped.status).toBe(200);
      expect(dropped.body.hasAIChanges).toBe(true);
    });

    it("is set to true when agent re-pushes existing markdown content", async () => {
      const agent = await login();
      const first = await agent.post("/api/agent/markdown").send({
        title: "Doc",
        markdown: "# Doc v1",
        externalId: "repush-1",
      });
      expect(first.status).toBe(201);

      // Clear the flag (simulating user has read it)
      await agent.patch(`/api/v1/items/${first.body.itemId}`).send({ hasAIChanges: false });
      const cleared = await agent.get(`/api/v1/items/${first.body.itemId}`);
      expect(cleared.body.hasAIChanges).toBe(false);

      // Re-push with updated content
      const second = await agent.post("/api/agent/markdown").send({
        title: "Doc",
        markdown: "# Doc v2",
        externalId: "repush-1",
      });
      expect(second.status).toBe(201);
      expect(second.body.itemId).toBe(first.body.itemId);

      const item = await agent.get(`/api/v1/items/${first.body.itemId}`);
      expect(item.body.hasAIChanges).toBe(true);
    });

    it("defaults createdBy to AI for API-key-authenticated requests", async () => {
      const session = await login();
      const keyRes = await session.post("/api/me/keys").send({});
      const apiKey = keyRes.body.key;

      const res = await request(app)
        .post("/api/v1/items")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ title: "Agent item" });
      expect(res.status).toBe(201);
      expect(res.body.createdBy).toBe("AI");
      expect(res.body.modifiedBy).toBe("AI");
      expect(res.body.hasAIChanges).toBe(true);
    });

    it("defaults modifiedBy to AI for API-key PATCH", async () => {
      const session = await login();
      const keyRes = await session.post("/api/me/keys").send({});
      const apiKey = keyRes.body.key;

      const created = await session.post("/api/v1/items").send({ title: "User item" });
      expect(created.body.hasAIChanges).toBe(false);

      const patched = await request(app)
        .patch(`/api/v1/items/${created.body.id}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ urgency: "DoNow" });
      expect(patched.status).toBe(200);
      expect(patched.body.modifiedBy).toBe("AI");
      expect(patched.body.hasAIChanges).toBe(true);
    });

    it("respects explicit createdBy override even with API key", async () => {
      const session = await login();
      const keyRes = await session.post("/api/me/keys").send({});
      const apiKey = keyRes.body.key;

      const res = await request(app)
        .post("/api/v1/items")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ title: "Explicit user item", createdBy: "User" });
      expect(res.status).toBe(201);
      expect(res.body.createdBy).toBe("User");
      expect(res.body.hasAIChanges).toBe(false);
    });

    it("session PATCH on AI-modified item does not re-trigger hasAIChanges", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "Task", createdBy: "AI" });
      expect(created.body.hasAIChanges).toBe(true);

      await agent.patch(`/api/v1/items/${created.body.id}`).send({ hasAIChanges: false });

      const patched = await agent.patch(`/api/v1/items/${created.body.id}`).send({ urgency: "DoNow" });
      expect(patched.status).toBe(200);
      expect(patched.body.modifiedBy).toBe("User");
      expect(patched.body.hasAIChanges).toBe(false);
    });

    it("user moving an AI-flagged item clears hasAIChanges", async () => {
      const agent = await login();
      const created = await agent.post("/api/v1/items").send({ title: "AI task", createdBy: "AI" });
      expect(created.body.hasAIChanges).toBe(true);

      const moved = await agent.patch(`/api/v1/items/${created.body.id}`).send({ urgency: "DoNow" });
      expect(moved.status).toBe(200);
      expect(moved.body.modifiedBy).toBe("User");
      expect(moved.body.hasAIChanges).toBe(false);
    });
  });

  describe("email change verification", () => {
    it("confirm-email-change rejects invalid token", async () => {
      const res = await request(app).post("/api/auth/confirm-email-change").send({ token: "invalid" });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("BAD_REQUEST");
    });

    it("confirm-email-change updates email and returns session cookie", async () => {
      const agent = await login("change@example.com");
      const me = await agent.get("/api/me");
      expect(me.status).toBe(200);
      const userId = me.body.user.id;
      const currentEmail = me.body.user.email;

      const result = await requestEmailChange(userId, currentEmail, "new@example.com");
      expect(result).not.toBeNull();
      expect(result!.token).toBeTruthy();

      const confirmRes = await request(app)
        .post("/api/auth/confirm-email-change")
        .send({ token: result!.token });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.user.email).toBe("new@example.com");

      const cookie = confirmRes.headers["set-cookie"];
      expect(cookie).toBeTruthy();
      const agent2 = request.agent(app);
      await agent2.set("Cookie", Array.isArray(cookie) ? cookie : [cookie]);
      const meAfter = await agent2.get("/api/me");
      expect(meAfter.status).toBe(200);
      expect(meAfter.body.user.email).toBe("new@example.com");
    });
  });
});
