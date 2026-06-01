import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { prisma } from "../db/prisma";
import type { Item } from "../domain/types";

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type ItemPushKind = "created" | "updated" | "note";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || "";

let webPushConfigured = false;

function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

function configureWebPush(): void {
  if (webPushConfigured || !isPushConfigured()) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  webPushConfigured = true;
}

function toPushSubscription(subscription: PushSubscriptionInput) {
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? undefined,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
}

function normalizeExpirationTime(value: number | null | undefined): Date | null {
  if (value == null) return null;
  const expiration = new Date(value);
  return Number.isNaN(expiration.getTime()) ? null : expiration;
}

function buildNotificationPayload(item: Item, kind: ItemPushKind) {
  const prefix =
    kind === "created" ? "AI created" : kind === "note" ? "AI added a note to" : "AI updated";

  return {
    title: `${prefix} item #${item.humanId}`,
    body: item.title,
    tag: `clawkpit-item-${item.id}`,
    url: "/board",
    itemId: item.id,
    humanId: item.humanId,
    kind,
  };
}

export function getPushPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

export function hasPushSupportConfigured(): boolean {
  return isPushConfigured();
}

export async function savePushSubscription(userId: string, subscription: PushSubscriptionInput): Promise<void> {
  if (!isPushConfigured()) throw new Error("PUSH_NOT_CONFIGURED");
  configureWebPush();
  const expirationTime = normalizeExpirationTime(subscription.expirationTime);
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      id: randomUUID(),
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expirationTime,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expirationTime,
      updatedAt: new Date(),
    },
  });
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<boolean> {
  const deleted = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return deleted.count > 0;
}

async function prunePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

async function sendToSubscription(subscription: { endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }, payload: ReturnType<typeof buildNotificationPayload>): Promise<boolean> {
  configureWebPush();
  if (!isPushConfigured()) return false;

  try {
    await webpush.sendNotification(toPushSubscription({
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime?.getTime() ?? null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }), JSON.stringify(payload));
    return true;
  } catch (error: any) {
    const statusCode = error?.statusCode ?? error?.status;
    if (statusCode === 404 || statusCode === 410) {
      await prunePushSubscription(subscription.endpoint);
    }
    return false;
  }
}

export async function sendItemPushNotification(userId: string, item: Item, kind: ItemPushKind): Promise<number> {
  if (!isPushConfigured()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (subscriptions.length === 0) return 0;

  const payload = buildNotificationPayload(item, kind);
  const results = await Promise.allSettled(subscriptions.map((subscription) => sendToSubscription(subscription, payload)));
  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}
