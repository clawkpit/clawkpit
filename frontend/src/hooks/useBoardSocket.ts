import { useEffect, useRef } from "react";

const WS_PATH = "/api/ws";
const MAX_RECONNECT_MS = 30_000;
const INITIAL_RECONNECT_MS = 1_000;
const BACKOFF_MULTIPLIER = 2;
/** Coalesce rapid events (e.g. batch mutations) into a single refetch. */
const DEBOUNCE_MS = 300;

function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${WS_PATH}`;
}

/**
 * Subscribes to real-time board change events via WebSocket.
 * Calls `onItemsChanged` (debounced) when the server broadcasts `items:changed`.
 * Automatically reconnects with exponential backoff on disconnect.
 * Defers the callback while the tab is hidden, firing once on visibility restore.
 */
export function useBoardSocket(onItemsChanged: () => void, enabled: boolean) {
  const callbackRef = useRef(onItemsChanged);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_MS);
  const pendingRefreshRef = useRef(false);

  callbackRef.current = onItemsChanged;

  function scheduleRefresh() {
    if (document.visibilityState !== "visible") {
      pendingRefreshRef.current = true;
      return;
    }
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      callbackRef.current();
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        callbackRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let closed = false;

    function connect() {
      const url = getWsUrl();
      if (!url) return;
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { type?: string };
          if (data.type === "items:changed") {
            scheduleRefresh();
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      ws.onclose = () => {
        ws = null;
        if (closed) return;
        const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_MS);
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * BACKOFF_MULTIPLIER,
          MAX_RECONNECT_MS
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, delay);
      };

      ws.onopen = () => {
        reconnectDelayRef.current = INITIAL_RECONNECT_MS;
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [enabled]);
}
