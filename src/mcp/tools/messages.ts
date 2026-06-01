import { z } from "zod";
import { addNote, createItem, getItem } from "../../services/itemService";
import { broadcastToUser } from "../../services/boardBroadcast";
import { queueItemPush } from "../../services/itemPush";
import { getMcpContext } from "../context";
import { sendUserMessageSchema } from "../schemas";

export async function handleSendUserMessage(args: z.infer<typeof sendUserMessageSchema>) {
  const { userId } = getMcpContext();

  if (args.item_id) {
    const note = await addNote(userId, args.item_id, {
      author: "AI",
      content: args.message,
    });
    broadcastToUser(userId, { type: "items:changed" });
    const item = await getItem(userId, args.item_id);
    if (item) queueItemPush(userId, item, "note");
    return { note, item_id: args.item_id };
  }

  const title = args.title?.trim() || "Message from your agent";
  const item = await createItem(userId, {
    title,
    description: args.message,
    tag: "ToDo",
    urgency: "DoToday",
    importance: "Medium",
    assignedTo: "User",
    createdBy: "AI",
    modifiedBy: "AI",
  });
  broadcastToUser(userId, { type: "items:changed" });
  queueItemPush(userId, item, "created");
  return { item };
}
