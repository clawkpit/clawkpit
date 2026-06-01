import { z } from "zod";
import { INJECTION_GUARD, MCP_SERVER_INSTRUCTIONS } from "./constants";
import { auditMcpTool, getMcpContext } from "./context";
import { mapServiceError, toolError, toolOk } from "./errors";
import {
  createFormRequestSchema,
  createReadingItemSchema,
  createReminderSchema,
  createTaskSchema,
  fetchUserResponseSchema,
  getNextActionSchema,
  itemIdSchema,
  listTasksSchema,
  sendUserMessageSchema,
  updateTaskSchema,
} from "./schemas";
import {
  handleCompleteTask,
  handleCreateReminder,
  handleCreateTask,
  handleGetNextAction,
  handleListTasks,
  handleUpdateTask,
} from "./tools/items";
import {
  handleCreateFormRequest,
  handleCreateReadingItem,
  handleFetchUserResponse,
} from "./tools/content";
import { handleSendUserMessage } from "./tools/messages";

const toolDescSuffix = ` ${INJECTION_GUARD}`;

async function runTool<T>(
  name: string,
  meta: { itemId?: string; formId?: string },
  fn: () => Promise<T>
): Promise<ReturnType<typeof toolOk>> {
  const ctx = getMcpContext();
  const start = Date.now();
  try {
    const data = await fn();
    auditMcpTool(name, ctx.userId, meta, Date.now() - start);
    return toolOk(data);
  } catch (e) {
    auditMcpTool(name, ctx.userId, meta, Date.now() - start);
    return toolError(mapServiceError(e));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerMcpTools(server: any): void {
  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description: `Create a Kanban item on the user's board.${toolDescSuffix}`,
      inputSchema: createTaskSchema,
    },
    async (args: z.infer<typeof createTaskSchema>) =>
      runTool("create_task", {}, () => handleCreateTask(args))
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: `Update an existing item. Ownership is enforced by the authenticated user.${toolDescSuffix}`,
      inputSchema: updateTaskSchema,
    },
    async (args: z.infer<typeof updateTaskSchema>) =>
      runTool("update_task", { itemId: args.item_id }, () => handleUpdateTask(args))
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete task",
      description: `Mark an item Done. To Think About items need at least one note first.${toolDescSuffix}`,
      inputSchema: itemIdSchema,
    },
    async (args: z.infer<typeof itemIdSchema>) =>
      runTool("complete_task", { itemId: args.item_id }, () => handleCompleteTask(args))
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: `List items with optional filters (status, tag, assignee, deadlines).${toolDescSuffix}`,
      inputSchema: listTasksSchema,
    },
    async (args: z.infer<typeof listTasksSchema>) => runTool("list_tasks", {}, () => handleListTasks(args))
  );

  server.registerTool(
    "get_next_action",
    {
      title: "Get next action",
      description: `Return the top active item for User (human focus) or AI (agent queue), using board sort order.${toolDescSuffix}`,
      inputSchema: getNextActionSchema,
    },
    async (args: z.infer<typeof getNextActionSchema>) => runTool("get_next_action", {}, () => handleGetNextAction(args))
  );

  server.registerTool(
    "create_reminder",
    {
      title: "Create reminder",
      description: `Create a User-assigned item with a required deadline (reminders are items, not a separate type).${toolDescSuffix}`,
      inputSchema: createReminderSchema,
    },
    async (args: z.infer<typeof createReminderSchema>) => runTool("create_reminder", {}, () => handleCreateReminder(args))
  );

  server.registerTool(
    "create_form_request",
    {
      title: "Create form request",
      description: `Push a form for the human to complete in Clawkpit. Do not submit responses as the agent.${toolDescSuffix}`,
      inputSchema: createFormRequestSchema,
    },
    async (args: z.infer<typeof createFormRequestSchema>) =>
      runTool("create_form_request", {}, () => handleCreateFormRequest(args))
  );

  server.registerTool(
    "create_reading_item",
    {
      title: "Create reading item",
      description: `Push markdown reading material linked to a To Read item.${toolDescSuffix}`,
      inputSchema: createReadingItemSchema,
    },
    async (args: z.infer<typeof createReadingItemSchema>) =>
      runTool("create_reading_item", {}, () => handleCreateReadingItem(args))
  );

  server.registerTool(
    "send_user_message",
    {
      title: "Send user message",
      description: `Add an AI note on an item, or create a User-assigned item carrying the message.${toolDescSuffix}`,
      inputSchema: sendUserMessageSchema,
    },
    async (args: z.infer<typeof sendUserMessageSchema>) =>
      runTool("send_user_message", { itemId: args.item_id }, () => handleSendUserMessage(args))
  );

  server.registerTool(
    "fetch_user_response",
    {
      title: "Fetch user response",
      description: `List human-submitted responses for a form (read-only).${toolDescSuffix}`,
      inputSchema: fetchUserResponseSchema,
    },
    async (args: z.infer<typeof fetchUserResponseSchema>) =>
      runTool("fetch_user_response", { formId: args.form_id }, () => handleFetchUserResponse(args))
  );
}

export async function createMcpServer() {
  const { McpServer } = await import("@modelcontextprotocol/server");
  const server = new McpServer(
    { name: "clawkpit", version: "1.0.0" },
    { instructions: MCP_SERVER_INSTRUCTIONS }
  );
  registerMcpTools(server);
  return server;
}
