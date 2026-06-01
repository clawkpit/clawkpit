import { z } from "zod";
import { ACTORS, IMPORTANCES, TAGS, URGENCIES } from "../domain/types";

const actor = z.enum(ACTORS);
const tag = z.enum(TAGS);
const urgency = z.enum(URGENCIES);
const importance = z.enum(IMPORTANCES);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  assigned_to: actor,
  description: z.string().max(10000).optional(),
  tag: tag.optional(),
  urgency: urgency.optional(),
  importance: importance.optional(),
  deadline: z.string().datetime().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    item_id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional(),
    tag: tag.optional(),
    urgency: urgency.optional(),
    importance: importance.optional(),
    deadline: z.string().datetime().nullable().optional(),
    assigned_to: actor.optional(),
    project_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.tag !== undefined ||
      v.urgency !== undefined ||
      v.importance !== undefined ||
      v.deadline !== undefined ||
      v.assigned_to !== undefined ||
      v.project_id !== undefined,
    "At least one field to update is required"
  );

export const itemIdSchema = z.object({
  item_id: z.string().uuid(),
});

export const listTasksSchema = z.object({
  status: z.enum(["Active", "Done", "Dropped", "All"]).default("Active"),
  tag: tag.optional(),
  assigned_to: actor.optional(),
  importance: importance.optional(),
  urgency: urgency.optional(),
  deadline_before: z.string().datetime().optional(),
  deadline_after: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(500).default(50),
});

export const getNextActionSchema = z.object({
  assignee: actor.default("User"),
  include_notes: z.boolean().default(false),
  include_linked_content: z.boolean().default(false),
});

export const createReminderSchema = z.object({
  title: z.string().min(1).max(500),
  deadline: z.string().datetime(),
  description: z.string().max(10000).optional(),
  importance: importance.optional(),
});

export const createFormRequestSchema = z.object({
  form_markdown: z.string().min(1).max(100000),
  title: z.string().max(500).optional(),
  external_id: z.string().max(255).optional(),
});

export const createReadingItemSchema = z.object({
  markdown: z.string().min(1).max(100000),
  title: z.string().max(500).optional(),
  external_id: z.string().max(255).optional(),
});

export const sendUserMessageSchema = z.object({
  message: z.string().min(1).max(50000),
  item_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500).optional(),
});

export const fetchUserResponseSchema = z.object({
  form_id: z.string().uuid(),
});

export function urgencyFromDeadline(deadlineIso: string): (typeof URGENCIES)[number] {
  const deadline = new Date(deadlineIso).getTime();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = deadline - now;
  if (diff <= dayMs) return "DoToday";
  if (diff <= 7 * dayMs) return "DoThisWeek";
  return "DoLater";
}
