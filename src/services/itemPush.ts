import type { Item } from "../domain/types";
import { sendItemPushNotification } from "./pushService";

export function queueItemPush(userId: string, item: Item, kind: "created" | "updated" | "note"): void {
  if (!item.hasAIChanges) return;
  void sendItemPushNotification(userId, item, kind).catch((error) => {
    console.error("[push] failed to send notification", error);
  });
}
