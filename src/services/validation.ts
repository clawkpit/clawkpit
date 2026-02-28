import { z } from "zod";
import { ACTORS, IMPORTANCES, STATUSES, TAGS, URGENCIES } from "../domain/types";

const urgency = z.enum(URGENCIES);
const tag = z.enum(TAGS);
const importance = z.enum(IMPORTANCES);
const actor = z.enum(ACTORS);
const status = z.enum(STATUSES);

export const createItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  urgency: urgency.default("Unclear"),
  tag: tag.default("ToDo"),
  importance: importance.default("Medium"),
  deadline: z.string().datetime().nullable().optional(),
  status: status.default("Active"),
  createdBy: actor.default("User")
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  urgency: urgency.optional(),
  tag: tag.optional(),
  importance: importance.optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: status.optional(),
  openedAt: z.string().datetime().optional(),
  modifiedBy: actor.default("User")
}).refine((v) => Object.keys(v).length > 0, "No fields provided");

export const listItemsQuerySchema = z.object({
  status: z.enum(["Active", "Done", "Dropped", "All"]).default("Active"),
  tag: tag.optional(),
  importance: importance.optional(),
  deadlineBefore: z.string().datetime().optional(),
  deadlineAfter: z.string().datetime().optional(),
  modifiedBy: actor.optional(),
  createdBy: actor.optional(),
  urgency: urgency.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50)
});

export const createNoteSchema = z.object({
  author: actor.default("User"),
  content: z.string().min(1).max(50000)
});

export const patchNoteSchema = z.object({
  actor: actor.default("User"),
  content: z.string().min(1).max(50000)
});

export const dropSchema = z.object({
  actor: actor.default("User"),
  note: z.string().min(1).max(50000).optional()
});

export const doneSchema = z.object({
  actor: actor.default("User")
});

export const requestMagicLinkSchema = z.object({
  email: z.string().email(),
  name: z.string().optional()
});

export const consumeMagicLinkSchema = z.object({
  token: z.string().min(10)
});

export const confirmEmailChangeSchema = z.object({
  token: z.string().min(10)
});

export const updateMeSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().max(255).optional()
}).refine((v) => Object.keys(v).length > 0, "No fields provided");

export const createApiKeySchema = z.object({
  name: z.string().max(255).optional()
});

export const openclawDeviceStartSchema = z.object({
  email: z.string().email()
});

export const openclawDeviceConfirmSchema = z.object({
  display_code: z.string().min(1).max(32)
});

export const openclawDevicePollSchema = z.object({
  device_code: z.string().min(1)
});

/** Reusable UUID for route params (e.g. item id, note id, api key id). */
export const uuidParam = z.string().uuid();

const MAX_BATCH_SIZE = 100;
export const batchSchema = z
  .array(
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("create"), payload: createItemSchema }),
      z.object({ action: z.literal("update"), id: z.string().uuid(), payload: updateItemSchema }),
    ])
  )
  .min(1)
  .max(MAX_BATCH_SIZE);
