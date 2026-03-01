/** Display tag values (with spaces) */
export type ItemTag = "To Read" | "To Think About" | "To Use" | "To Do";
/** Display importance: H, M, L */
export type ItemImportance = "H" | "M" | "L";
/** Urgency / column */
export type ItemColumn = "DoNow" | "DoToday" | "DoThisWeek" | "DoLater" | "Unclear";
export type ItemStatus = "Active" | "Done" | "Dropped";
export type ItemAuthor = "User" | "AI";

export interface ItemNote {
  id: string;
  content: string;
  author: ItemAuthor;
  createdAt: Date;
  updatedAt: Date;
}

/** When item has contentId, this indicates the type of agent-pushed content. */
export type ItemContentType = "markdown" | "form";

export interface Item {
  id: string;
  humanId: number;
  title: string;
  description: string;
  tag: ItemTag;
  importance: ItemImportance;
  column: ItemColumn;
  status: ItemStatus;
  deadline?: Date;
  createdBy: ItemAuthor;
  modifiedBy: ItemAuthor;
  modifiedAt: Date;
  hasAIChanges: boolean;
  notes?: ItemNote[];
  /** Set when item is backed by agent-pushed markdown (ToRead) or form (ToDo). */
  contentId?: string;
  /** The type of linked agent content. Only present when contentId is set. */
  contentType?: ItemContentType;
}

export interface FilterState {
  importance: ItemImportance | "All";
  hasDeadline: "All" | "Yes" | "No";
  createdBy: ItemAuthor | "All";
  modifiedBy: ItemAuthor | "All";
}

/** Backend tag (no spaces) */
export const TAG_TO_BACKEND: Record<ItemTag, string> = {
  "To Read": "ToRead",
  "To Think About": "ToThinkAbout",
  "To Use": "ToUse",
  "To Do": "ToDo",
};

export const BACKEND_TO_TAG: Record<string, ItemTag> = {
  ToRead: "To Read",
  ToThinkAbout: "To Think About",
  ToUse: "To Use",
  ToDo: "To Do",
};

/** Backend importance */
export const IMPORTANCE_TO_BACKEND: Record<ItemImportance, string> = {
  H: "High",
  M: "Medium",
  L: "Low",
};

export const BACKEND_TO_IMPORTANCE: Record<string, ItemImportance> = {
  High: "H",
  Medium: "M",
  Low: "L",
};

export const COLUMNS_URGENCY: { key: ItemColumn; title: string }[] = [
  { key: "DoNow", title: "Do Now" },
  { key: "DoToday", title: "Do Today" },
  { key: "DoThisWeek", title: "Do This Week" },
  { key: "DoLater", title: "Do Later" },
  { key: "Unclear", title: "Unclear" },
];

export const COLUMNS_TAG: { key: ItemTag; title: string }[] = [
  { key: "To Read", title: "To Read" },
  { key: "To Think About", title: "To Think About" },
  { key: "To Use", title: "To Use" },
  { key: "To Do", title: "To Do" },
];

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/** Time left or overdue for a deadline; use with a minute tick so it refreshes. */
export function formatDeadline(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(Math.abs(diffMs) / 3600000);
  const diffDays = Math.floor(Math.abs(diffMs) / 86400000);
  if (diffMs < 0) {
    if (diffHours < 1) return `${Math.floor(Math.abs(diffMs) / 60000)}m overdue`;
    if (diffHours < 24) return `${diffHours}h overdue`;
    if (diffDays < 7) return `${diffDays}d overdue`;
    return `${diffDays}d overdue`;
  }
  if (diffHours < 1) return `${Math.floor(diffMs / 60000)}m left`;
  if (diffHours < 24) return `${diffHours}h left`;
  if (diffDays < 7) return `${diffDays}d left`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getItemsByColumn(column: ItemColumn, items: Item[]): Item[] {
  return items.filter((i) => i.column === column && i.status === "Active");
}

export function getItemsByTag(tag: ItemTag, items: Item[]): Item[] {
  return items.filter((i) => i.tag === tag && i.status === "Active");
}
