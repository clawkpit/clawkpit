import { useState, useEffect } from "react";

/** Causes a re-render every 60s so time-based UI (e.g. "2h left", "3d overdue") stays current. */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return tick;
}
