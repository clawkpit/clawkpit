const URGENCIES = ["DoNow", "DoToday", "DoThisWeek", "DoLater", "Unclear"] as const;
export type Urgency = (typeof URGENCIES)[number];

/** Match MCP `urgencyFromDeadline` so create-reminder behavior matches MCP. */
export function urgencyFromDeadline(deadlineIso: string): Urgency {
  const deadline = new Date(deadlineIso).getTime();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = deadline - now;
  if (diff <= dayMs) return "DoToday";
  if (diff <= 7 * dayMs) return "DoThisWeek";
  return "DoLater";
}
