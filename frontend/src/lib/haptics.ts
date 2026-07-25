/**
 * Light haptic / vibration feedback for meaningful actions.
 * Uses the Vibration API where available (typically Android Chrome).
 * iOS Safari PWAs do not expose a vibration/haptic API — this is a no-op there.
 */

export type HapticPattern = "light" | "medium" | "success" | "warning" | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  success: [10, 40, 10],
  warning: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(pattern: HapticPattern = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Unsupported or blocked — ignore
  }
}
