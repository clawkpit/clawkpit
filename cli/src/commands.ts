import { readFileSync } from "node:fs";
import {
  asBoolean,
  asNumber,
  asString,
  mergeInputs,
  requireString,
  type ParsedArgs,
} from "./args.js";
import { ApiClient, ApiRequestError } from "./client.js";
import {
  clearConfigToken,
  loadConfig,
  resolveApiToken,
  resolveBaseUrl,
  saveConfig,
} from "./config.js";
import { fail, ok } from "./output.js";
import { urgencyFromDeadline } from "./urgency.js";

const POLL_INTERVAL_MS = 3000;
const CONNECT_TIMEOUT_MS = 10 * 60 * 1000;

export const COMMANDS = [
  "connect",
  "status",
  "logout",
  "create-task",
  "update-task",
  "complete-task",
  "list-tasks",
  "get-next-action",
  "create-reminder",
  "create-form-request",
  "create-reading-item",
  "send-user-message",
  "fetch-user-response",
] as const;

export type CommandName = (typeof COMMANDS)[number];

const ALIASES: Record<string, CommandName> = {
  create_task: "create-task",
  update_task: "update-task",
  complete_task: "complete-task",
  list_tasks: "list-tasks",
  get_next_action: "get-next-action",
  create_reminder: "create-reminder",
  create_form_request: "create-form-request",
  create_reading_item: "create-reading-item",
  send_user_message: "send-user-message",
  fetch_user_response: "fetch-user-response",
};

export function resolveCommand(name: string | undefined): CommandName | undefined {
  if (!name) return undefined;
  if ((COMMANDS as readonly string[]).includes(name)) return name as CommandName;
  return ALIASES[name];
}

export function helpPayload() {
  return {
    name: "clawkpit",
    description: "Clawkpit CLI for AI agents (JSON-only). Prefer over MCP when available.",
    auth: {
      env: ["CLAWKPIT_BASE_URL", "CLAWKPIT_API_TOKEN"],
      commands: ["connect", "status", "logout"],
    },
    commands: [
      {
        name: "connect",
        args: ["email"],
        flags: ["--base-url", "--no-wait"],
        description: "Device-flow auth; stores API token locally. Prints display_code immediately, then polls.",
      },
      { name: "status", description: "Show connected account (GET /api/me)." },
      { name: "logout", description: "Remove stored API token from local config." },
      {
        name: "create-task",
        mcp: "create_task",
        required: ["--title", "--assigned-to"],
        optional: ["--description", "--tag", "--urgency", "--importance", "--deadline", "--project-id", "--json"],
      },
      {
        name: "update-task",
        mcp: "update_task",
        required: ["--item-id"],
        optional: ["--title", "--description", "--tag", "--urgency", "--importance", "--deadline", "--assigned-to", "--project-id", "--json"],
      },
      { name: "complete-task", mcp: "complete_task", required: ["--item-id"] },
      {
        name: "list-tasks",
        mcp: "list_tasks",
        optional: [
          "--status",
          "--tag",
          "--assigned-to",
          "--importance",
          "--urgency",
          "--deadline-before",
          "--deadline-after",
          "--page",
          "--page-size",
          "--json",
        ],
      },
      {
        name: "get-next-action",
        mcp: "get_next_action",
        optional: ["--assignee", "--include-notes", "--include-linked-content", "--json"],
      },
      {
        name: "create-reminder",
        mcp: "create_reminder",
        required: ["--title", "--deadline"],
        optional: ["--description", "--importance", "--json"],
      },
      {
        name: "create-form-request",
        mcp: "create_form_request",
        required: ["--form-markdown | --form-markdown-file"],
        optional: ["--title", "--external-id", "--json"],
      },
      {
        name: "create-reading-item",
        mcp: "create_reading_item",
        required: ["--markdown | --markdown-file"],
        optional: ["--title", "--external-id", "--json"],
      },
      {
        name: "send-user-message",
        mcp: "send_user_message",
        required: ["--message"],
        optional: ["--item-id", "--title", "--json"],
      },
      {
        name: "fetch-user-response",
        mcp: "fetch_user_response",
        required: ["--form-id"],
      },
    ],
    notes: [
      "All successful and failed responses are a single JSON object on stdout.",
      "Flags use kebab-case; --json accepts an object using MCP snake_case field names.",
      "Snake_case command aliases (e.g. create_task) are accepted.",
      "Never print API tokens.",
    ],
  };
}

function createClient(apiToken?: string): ApiClient {
  const config = loadConfig();
  return new ApiClient({
    baseUrl: resolveBaseUrl(config),
    apiToken: apiToken ?? resolveApiToken(config),
  });
}

function handleApiError(e: unknown): never {
  if (e instanceof ApiRequestError) {
    fail(e.code, e.message, e.details, e.status >= 400 && e.status < 600 ? 1 : 1);
  }
  if (e instanceof Error) {
    fail("CLI_ERROR", e.message);
  }
  fail("CLI_ERROR", "Unknown error");
}

function readFileArg(path: string): string {
  if (path === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(path, "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cmdConnect(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const email = parsed.positionals[0] || asString(inputs.email);
    if (!email) {
      fail("BAD_REQUEST", "Usage: clawkpit connect <email>");
    }

    const baseUrlOverride = asString(inputs.base_url);
    if (baseUrlOverride) {
      saveConfig({ baseUrl: baseUrlOverride.replace(/\/+$/, "") });
    }

    const noWait = asBoolean(inputs.no_wait, false);
    const client = createClient();

    const start = await client.post<{
      display_code: string;
      device_code: string;
      expires_at: string;
    }>("/api/openclaw/device/start", { email }, false);

    // Immediate pending payload for the agent to show the user (no secrets).
    const pending = {
      status: "pending" as const,
      display_code: start.display_code,
      url: client.baseUrl,
      expires_at: start.expires_at,
      email,
      message: "Open the URL while signed in to Clawkpit and enter the display_code to authorize.",
    };

    if (noWait) {
      ok({
        ...pending,
        note: "Polling skipped (--no-wait). Re-run without --no-wait, or poll device flow via REST.",
      });
    }

    // Print pending once so agents can surface the code before blocking on poll.
    process.stdout.write(`${JSON.stringify({ ok: true, ...pending })}\n`);

    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const poll = await client.post<{
          status: "pending" | "authorized";
          api_token?: string;
        }>("/api/openclaw/device/poll", { device_code: start.device_code }, false);

        if (poll.status === "authorized" && poll.api_token) {
          saveConfig({
            baseUrl: client.baseUrl,
            apiToken: poll.api_token,
          });
          const authed = createClient(poll.api_token);
          let user: unknown = null;
          try {
            const me = await authed.get<{ user: unknown }>("/api/me");
            user = me.user;
          } catch {
            user = null;
          }
          ok({
            status: "authorized",
            user,
            message: "Connected. API token stored locally; it is not printed.",
          });
        }
      } catch (e) {
        if (e instanceof ApiRequestError && (e.status === 410 || e.code === "GONE")) {
          fail("EXPIRED", "Device code expired or already consumed. Run connect again.");
        }
        // Rate limit / pending: keep polling
        if (e instanceof ApiRequestError && e.status === 429) {
          continue;
        }
        if (e instanceof ApiRequestError && e.status >= 500) {
          continue;
        }
        // pending responses should be 200; other errors abort
        if (e instanceof ApiRequestError && e.status !== 404) {
          handleApiError(e);
        }
      }
    }

    fail("TIMEOUT", "Timed out waiting for authorization. Run connect again.");
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdStatus(): Promise<void> {
  try {
    const client = createClient();
    const me = await client.get<{ user: { id: string; email: string; name?: string } }>("/api/me");
    ok({
      connected: true,
      base_url: client.baseUrl,
      user: me.user,
      token_source: process.env.CLAWKPIT_API_TOKEN || process.env.CLAWKPIT_API_KEY ? "env" : "config",
    });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdLogout(): Promise<void> {
  clearConfigToken();
  ok({ logged_out: true, message: "Removed stored API token from local config." });
}

async function cmdCreateTask(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const title = requireString(inputs, "title");
    const assignedTo = requireString(inputs, "assigned_to");
    const body: Record<string, unknown> = {
      title,
      assignedTo,
      createdBy: "AI",
      modifiedBy: "AI",
    };
    const description = asString(inputs.description);
    if (description !== undefined) body.description = description;
    const tag = asString(inputs.tag);
    if (tag !== undefined) body.tag = tag;
    const urgency = asString(inputs.urgency);
    if (urgency !== undefined) body.urgency = urgency;
    const importance = asString(inputs.importance);
    if (importance !== undefined) body.importance = importance;
    if ("deadline" in inputs) body.deadline = inputs.deadline === null || inputs.deadline === "null" ? null : inputs.deadline;
    if ("project_id" in inputs) {
      body.projectId = inputs.project_id === null || inputs.project_id === "null" ? null : inputs.project_id;
    }

    const client = createClient();
    const item = await client.post("/api/v1/items", body);
    ok({ item });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdUpdateTask(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const itemId = requireString(inputs, "item_id");
    const body: Record<string, unknown> = { modifiedBy: "AI" };
    for (const [src, dest] of [
      ["title", "title"],
      ["description", "description"],
      ["tag", "tag"],
      ["urgency", "urgency"],
      ["importance", "importance"],
      ["assigned_to", "assignedTo"],
    ] as const) {
      if (src in inputs) body[dest] = inputs[src];
    }
    if ("deadline" in inputs) {
      body.deadline = inputs.deadline === null || inputs.deadline === "null" ? null : inputs.deadline;
    }
    if ("project_id" in inputs) {
      body.projectId = inputs.project_id === null || inputs.project_id === "null" ? null : inputs.project_id;
    }

    const fieldCount = Object.keys(body).length - 1; // exclude modifiedBy
    if (fieldCount < 1) {
      fail("BAD_REQUEST", "At least one field to update is required");
    }

    const client = createClient();
    const item = await client.patch(`/api/v1/items/${itemId}`, body);
    ok({ item });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdCompleteTask(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const itemId = requireString(inputs, "item_id");
    const client = createClient();
    const item = await client.post(`/api/v1/items/${itemId}/done`, { actor: "AI" });
    ok({ item });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdListTasks(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const status = asString(inputs.status) ?? "Active";
    const page = asNumber(inputs.page) ?? 1;
    const pageSize = asNumber(inputs.page_size) ?? 50;
    const query: Record<string, string | number | undefined> = {
      status,
      page,
      pageSize,
      tag: asString(inputs.tag),
      assignedTo: asString(inputs.assigned_to),
      importance: asString(inputs.importance),
      urgency: asString(inputs.urgency),
      deadlineBefore: asString(inputs.deadline_before),
      deadlineAfter: asString(inputs.deadline_after),
    };
    const client = createClient();
    const result = await client.get<{
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    }>("/api/v1/items", query);
    ok({
      items: result.items,
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdGetNextAction(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const assignee = asString(inputs.assignee) ?? "User";
    const includeNotes = asBoolean(inputs.include_notes, false);
    const includeLinked = asBoolean(inputs.include_linked_content, false);
    const client = createClient();
    const result = await client.get<{ items: Array<Record<string, unknown>> }>("/api/v1/items", {
      status: "Active",
      assignedTo: assignee,
      page: 1,
      pageSize: 1,
    });
    const item = result.items[0];
    if (!item) {
      ok({
        item: null,
        rationale:
          assignee === "User"
            ? "No active items assigned to the user."
            : "No active items in the agent queue.",
      });
    }

    const parts: string[] = [];
    if (item.deadline) parts.push(`deadline ${item.deadline}`);
    parts.push(`${item.importance} importance`);
    if (item.urgency !== "Unclear") parts.push(`${item.urgency} urgency`);

    const out: Record<string, unknown> = {
      item,
      rationale: `Top item by board sort (${parts.join(", ")}).`,
    };

    if (includeNotes) {
      try {
        out.notes = await client.get(`/api/v1/items/${item.id}/notes`);
      } catch {
        out.notes = [];
      }
    }

    if (includeLinked && item.contentId) {
      const contentType = item.contentType;
      if (contentType === "markdown") {
        const content = await client.get<{
          id: string;
          title: string | null;
          markdown: string;
        }>(`/api/markdown/${item.contentId}`);
        out.linked_content = {
          type: "markdown",
          id: content.id,
          title: content.title,
          markdown: content.markdown,
        };
      } else if (contentType === "form") {
        const content = await client.get<{
          id: string;
          title: string | null;
          formMarkdown: string;
        }>(`/api/forms/${item.contentId}`);
        out.linked_content = {
          type: "form",
          id: content.id,
          title: content.title,
          form_markdown: content.formMarkdown,
        };
      }
    }

    ok(out);
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdCreateReminder(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const title = requireString(inputs, "title");
    const deadline = requireString(inputs, "deadline");
    const body: Record<string, unknown> = {
      title,
      description: asString(inputs.description) ?? "",
      deadline,
      urgency: urgencyFromDeadline(deadline),
      importance: asString(inputs.importance) ?? "Medium",
      tag: "ToDo",
      assignedTo: "User",
      createdBy: "AI",
      modifiedBy: "AI",
    };
    const client = createClient();
    const item = await client.post("/api/v1/items", body);
    ok({
      item,
      note: "Reminders are items with a deadline (no separate reminder type).",
    });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdCreateFormRequest(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    let formMarkdown = asString(inputs.form_markdown);
    const file = asString(inputs.form_markdown_file);
    if (file) formMarkdown = readFileArg(file);
    if (!formMarkdown?.trim()) {
      fail("BAD_REQUEST", "Missing required argument: --form-markdown or --form-markdown-file");
    }
    const body: Record<string, unknown> = { formMarkdown };
    const title = asString(inputs.title);
    if (title !== undefined) body.title = title;
    const externalId = asString(inputs.external_id);
    if (externalId !== undefined) body.externalId = externalId;

    const client = createClient();
    const result = await client.post<{
      formId: string;
      itemId: string;
      action: string;
    }>("/api/agent/form", body);
    ok({
      form_id: result.formId,
      item_id: result.itemId,
      action: result.action,
    });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdCreateReadingItem(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    let markdown = asString(inputs.markdown);
    const file = asString(inputs.markdown_file);
    if (file) markdown = readFileArg(file);
    if (!markdown?.trim()) {
      fail("BAD_REQUEST", "Missing required argument: --markdown or --markdown-file");
    }
    const body: Record<string, unknown> = { markdown };
    const title = asString(inputs.title);
    if (title !== undefined) body.title = title;
    const externalId = asString(inputs.external_id);
    if (externalId !== undefined) body.externalId = externalId;

    const client = createClient();
    const result = await client.post<{
      markdownId: string;
      itemId: string;
      action: string;
    }>("/api/agent/markdown", body);
    ok({
      markdown_id: result.markdownId,
      item_id: result.itemId,
      action: result.action,
    });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdSendUserMessage(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const message = requireString(inputs, "message");
    const itemId = asString(inputs.item_id);
    const client = createClient();

    if (itemId) {
      const note = await client.post(`/api/v1/items/${itemId}/notes`, {
        author: "AI",
        content: message,
      });
      ok({ note, item_id: itemId });
    }

    const title = asString(inputs.title)?.trim() || "Message from your agent";
    const item = await client.post("/api/v1/items", {
      title,
      description: message,
      tag: "ToDo",
      urgency: "DoToday",
      importance: "Medium",
      assignedTo: "User",
      createdBy: "AI",
      modifiedBy: "AI",
    });
    ok({ item });
  } catch (e) {
    handleApiError(e);
  }
}

async function cmdFetchUserResponse(parsed: ParsedArgs): Promise<void> {
  try {
    const inputs = mergeInputs(parsed.flags, parsed.json);
    const formId = requireString(inputs, "form_id");
    const client = createClient();
    // Validate it is a form the user owns
    const content = await client.get<{ id: string; formMarkdown?: string }>(`/api/forms/${formId}`);
    if (!content || !("formMarkdown" in content)) {
      fail("NOT_A_FORM", "Content is not a form");
    }
    const result = await client.get<{ responses: unknown[] }>(
      `/api/agent/forms/${formId}/responses`
    );
    ok({ responses: result.responses });
  } catch (e) {
    handleApiError(e);
  }
}

export async function runCommand(parsed: ParsedArgs): Promise<void> {
  if (parsed.help || !parsed.command) {
    ok(helpPayload());
  }

  const command = resolveCommand(parsed.command);
  if (!command) {
    fail("UNKNOWN_COMMAND", `Unknown command: ${parsed.command}`, {
      commands: [...COMMANDS],
    });
  }

  switch (command) {
    case "connect":
      return cmdConnect(parsed);
    case "status":
      return cmdStatus();
    case "logout":
      return cmdLogout();
    case "create-task":
      return cmdCreateTask(parsed);
    case "update-task":
      return cmdUpdateTask(parsed);
    case "complete-task":
      return cmdCompleteTask(parsed);
    case "list-tasks":
      return cmdListTasks(parsed);
    case "get-next-action":
      return cmdGetNextAction(parsed);
    case "create-reminder":
      return cmdCreateReminder(parsed);
    case "create-form-request":
      return cmdCreateFormRequest(parsed);
    case "create-reading-item":
      return cmdCreateReadingItem(parsed);
    case "send-user-message":
      return cmdSendUserMessage(parsed);
    case "fetch-user-response":
      return cmdFetchUserResponse(parsed);
    default: {
      const _exhaustive: never = command;
      fail("UNKNOWN_COMMAND", `Unhandled command: ${_exhaustive}`);
    }
  }
}
