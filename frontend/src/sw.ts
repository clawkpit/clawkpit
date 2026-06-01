// @ts-nocheck
/// <reference lib="webworker" />
/// <reference lib="webworker.importscripts" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  itemId?: string;
};

clientsClaim();
self.skipWaiting();
precacheAndRoute(self.__WB_MANIFEST);

function isVisibleWindowClient(client: Client): client is WindowClient {
  return "visibilityState" in client && (client as WindowClient).visibilityState === "visible";
}

function parsePushPayload(data: PushMessageData | null): PushPayload | undefined {
  if (!data) return undefined;
  try {
    return data.json() as PushPayload;
  } catch {
    return undefined;
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event.data);
  const notification = {
    title: payload?.title ?? "Clawkpit update",
    body: payload?.body ?? "AI changed an item.",
    url: payload?.url ?? "/board",
    tag: payload?.tag ?? "clawkpit-ai-change",
  };

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windowClients.some(isVisibleWindowClient)) return;

      await self.registration.showNotification(notification.title, {
        body: notification.body,
        tag: notification.tag,
        data: { url: notification.url },
        icon: "/pwa/icon-192x192.png",
        badge: "/pwa/icon-192x192.png",
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification as Notification & { data?: { url?: string } };
  const targetUrl = new URL(notification.data?.url ?? "/board", self.location.origin).href;
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if ("focus" in client) {
          const windowClient = client as WindowClient;
          if (windowClient.url === targetUrl) {
            await windowClient.focus();
            return;
          }
        }
      }

      const existingClient = windowClients.find((client) => "focus" in client) as WindowClient | undefined;
      if (existingClient) {
        await existingClient.focus();
        if ("navigate" in existingClient) {
          await existingClient.navigate(targetUrl);
        }
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});
