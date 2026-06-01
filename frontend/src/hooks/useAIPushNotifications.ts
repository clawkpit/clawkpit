import { useCallback, useEffect, useState } from "react";
import { getPushPublicKey, removePushSubscription, savePushSubscription } from "@/api/client";

type PushPermissionState = NotificationPermission | "unsupported";

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function getCurrentPermission(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useAIPushNotifications(active: boolean) {
  const supported = isPushSupported();
  const [permission, setPermission] = useState<PushPermissionState>(getCurrentPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active) return;
    setError(null);
    setPermission(getCurrentPermission());

    if (!supported) {
      setSubscribed(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(subscription));
      if (subscription && Notification.permission === "granted") {
        await savePushSubscription(subscription.toJSON());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh push subscription.");
    }
  }, [active, supported]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  const enable = useCallback(async () => {
    if (!supported) {
      setError("Push notifications are not supported in this browser.");
      setSubscribed(false);
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const currentPermission = Notification.permission;
      if (currentPermission !== "granted") {
        const requested = await Notification.requestPermission();
        setPermission(requested);
        if (requested !== "granted") {
          setSubscribed(false);
          return false;
        }
      } else {
        setPermission("granted");
      }

      const publicKey = await getPushPublicKey();
      if (!publicKey) throw new Error("Push notifications are not configured on this server.");

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await savePushSubscription(subscription.toJSON());
      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable push notifications.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) {
      setSubscribed(false);
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setSubscribed(false);
        return true;
      }

      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscribed(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable push notifications.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return {
    supported,
    permission,
    subscribed,
    loading,
    error,
    refresh,
    enable,
    disable,
  };
}
