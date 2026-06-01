import { z } from "zod";
import {
  createItem,
  getItem,
  listItems,
  listNotes,
  markDone,
  patchItem,
} from "../../services/itemService";
import { getContent } from "../../services/agentContentService";
import { broadcastToUser } from "../../services/boardBroadcast";
import { queueItemPush } from "../../services/itemPush";
import { getMcpContext } from "../context";
import {
  createReminderSchema,
  createTaskSchema,
  getNextActionSchema,
  itemIdSchema,
  listTasksSchema,
  updateTaskSchema,
  urgencyFromDeadline,
} from "../schemas";

export async function handleCreateTask(args: z.infer<typeof createTaskSchema>) {
  const { userId } = getMcpContext();
  const item = await createItem(userId, {
    title: args.title,
    description: args.description ?? "",
    tag: args.tag,
    urgency: args.urgency,
    importance: args.importance,
    deadline: args.deadline,
    projectId: args.project_id,
    assignedTo: args.assigned_to,
    createdBy: "AI",
    modifiedBy: "AI",
  });
  broadcastToUser(userId, { type: "items:changed" });
  queueItemPush(userId, item, "created");
  return { item };
}

export async function handleUpdateTask(args: z.infer<typeof updateTaskSchema>) {
  const { userId } = getMcpContext();
  const { item_id, ...fields } = args;
  const payload: Record<string, unknown> = { modifiedBy: "AI" };
  if (fields.title !== undefined) payload.title = fields.title;
  if (fields.description !== undefined) payload.description = fields.description;
  if (fields.tag !== undefined) payload.tag = fields.tag;
  if (fields.urgency !== undefined) payload.urgency = fields.urgency;
  if (fields.importance !== undefined) payload.importance = fields.importance;
  if (fields.deadline !== undefined) payload.deadline = fields.deadline;
  if (fields.assigned_to !== undefined) payload.assignedTo = fields.assigned_to;
  if (fields.project_id !== undefined) payload.projectId = fields.project_id;

  const item = await patchItem(userId, item_id, payload);
  if (!item) throw new Error("NOT_FOUND");
  broadcastToUser(userId, { type: "items:changed" });
  queueItemPush(userId, item, "updated");
  return { item };
}

export async function handleCompleteTask(args: z.infer<typeof itemIdSchema>) {
  const { userId } = getMcpContext();
  const item = await markDone(userId, args.item_id, "AI");
  broadcastToUser(userId, { type: "items:changed" });
  return { item };
}

export async function handleListTasks(args: z.infer<typeof listTasksSchema>) {
  const { userId } = getMcpContext();
  const result = await listItems(userId, {
    status: args.status,
    tag: args.tag,
    assignedTo: args.assigned_to,
    importance: args.importance,
    urgency: args.urgency,
    deadlineBefore: args.deadline_before,
    deadlineAfter: args.deadline_after,
    page: args.page,
    pageSize: args.page_size,
  });
  return {
    items: result.items,
    total: result.total,
    page: args.page,
    page_size: args.page_size,
  };
}

export async function handleGetNextAction(args: z.infer<typeof getNextActionSchema>) {
  const { userId } = getMcpContext();
  const result = await listItems(userId, {
    status: "Active",
    assignedTo: args.assignee,
    page: 1,
    pageSize: 1,
  });
  const item = result.items[0];
  if (!item) {
    return {
      item: null,
      rationale: args.assignee === "User"
        ? "No active items assigned to the user."
        : "No active items in the agent queue.",
    };
  }

  const parts: string[] = [];
  if (item.deadline) parts.push(`deadline ${item.deadline}`);
  parts.push(`${item.importance} importance`);
  if (item.urgency !== "Unclear") parts.push(`${item.urgency} urgency`);

  const out: Record<string, unknown> = {
    item,
    rationale: `Top item by board sort (${parts.join(", ")}).`,
  };

  if (args.include_notes) {
    try {
      out.notes = await listNotes(userId, item.id);
    } catch {
      out.notes = [];
    }
  }

  if (args.include_linked_content && item.contentId) {
    const content = await getContent(userId, item.contentId);
    if (content?.type === "markdown") {
      out.linked_content = {
        type: "markdown",
        id: content.id,
        title: content.title,
        markdown: content.body,
      };
    } else if (content?.type === "form") {
      out.linked_content = {
        type: "form",
        id: content.id,
        title: content.title,
        form_markdown: content.body,
      };
    }
  }

  return out;
}

export async function handleCreateReminder(args: z.infer<typeof createReminderSchema>) {
  const { userId } = getMcpContext();
  const item = await createItem(userId, {
    title: args.title,
    description: args.description ?? "",
    deadline: args.deadline,
    urgency: urgencyFromDeadline(args.deadline),
    importance: args.importance ?? "Medium",
    tag: "ToDo",
    assignedTo: "User",
    createdBy: "AI",
    modifiedBy: "AI",
  });
  broadcastToUser(userId, { type: "items:changed" });
  queueItemPush(userId, item, "created");
  return { item, note: "Reminders are items with a deadline (no separate reminder type)." };
}
