declare module "web-push" {
  interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }

  interface PushSubscriptionPayload {
    endpoint: string;
    expirationTime?: number | null;
    keys: PushSubscriptionKeys;
  }

  interface WebPushError extends Error {
    statusCode?: number;
  }

  interface WebPushModule {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscriptionPayload, payload?: string): Promise<void>;
  }

  const webpush: WebPushModule;
  export default webpush;
}
