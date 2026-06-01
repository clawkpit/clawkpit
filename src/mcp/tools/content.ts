import { z } from "zod";
import { getContent, getFormResponses, upsertForm, upsertMarkdown } from "../../services/agentContentService";
import { getItem } from "../../services/itemService";
import { broadcastToUser } from "../../services/boardBroadcast";
import { queueItemPush } from "../../services/itemPush";
import { getMcpContext } from "../context";
import {
  createFormRequestSchema,
  createReadingItemSchema,
  fetchUserResponseSchema,
} from "../schemas";

export async function handleCreateFormRequest(args: z.infer<typeof createFormRequestSchema>) {
  const { userId } = getMcpContext();
  const result = await upsertForm(userId, {
    title: args.title,
    formMarkdown: args.form_markdown,
    externalId: args.external_id,
  });
  broadcastToUser(userId, { type: "items:changed" });
  const item = await getItem(userId, result.itemId);
  if (item) queueItemPush(userId, item, result.action);
  return {
    form_id: result.formId,
    item_id: result.itemId,
    action: result.action,
  } as const;
}

export async function handleCreateReadingItem(args: z.infer<typeof createReadingItemSchema>) {
  const { userId } = getMcpContext();
  const result = await upsertMarkdown(userId, {
    title: args.title,
    markdown: args.markdown,
    externalId: args.external_id,
  });
  broadcastToUser(userId, { type: "items:changed" });
  const item = await getItem(userId, result.itemId);
  if (item) queueItemPush(userId, item, result.action);
  return {
    markdown_id: result.markdownId,
    item_id: result.itemId,
    action: result.action,
  };
}

export async function handleFetchUserResponse(args: z.infer<typeof fetchUserResponseSchema>) {
  const { userId } = getMcpContext();
  const content = await getContent(userId, args.form_id);
  if (!content) throw new Error("NOT_FOUND");
  if (content.type !== "form") throw new Error("NOT_A_FORM");
  const responses = await getFormResponses(userId, args.form_id);
  return { responses };
}
