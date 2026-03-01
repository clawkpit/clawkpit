export const URGENCIES = ["DoNow", "DoToday", "DoThisWeek", "DoLater", "Unclear"] as const;
export const TAGS = ["ToRead", "ToThinkAbout", "ToUse", "ToDo"] as const;
export const IMPORTANCES = ["High", "Medium", "Low"] as const;
export const STATUSES = ["Active", "Done", "Dropped"] as const;
export const ACTORS = ["User", "AI"] as const;

export type Urgency = (typeof URGENCIES)[number];
export type Tag = (typeof TAGS)[number];
export type Importance = (typeof IMPORTANCES)[number];
export type Status = (typeof STATUSES)[number];
export type Actor = (typeof ACTORS)[number];

export type Item = {
  id: string;
  humanId: number;
  userId: string;
  title: string;
  description: string;
  urgency: Urgency;
  tag: Tag;
  importance: Importance;
  deadline: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  openedAt: string;
  createdBy: Actor;
  modifiedBy: Actor;
  /** True when the AI agent has created or modified this item since the user last opened it. */
  hasAIChanges: boolean;
  /** When set, item is backed by agent-pushed content (markdown or form). */
  contentId?: string | null;
  /** The type of linked agent content. Only present when contentId is set. */
  contentType?: AgentContentType | null;
};

export type AgentContentType = "markdown" | "form";

export type AgentContent = {
  id: string;
  userId: string;
  type: AgentContentType;
  title: string | null;
  body: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FormResponse = {
  id: string;
  userId: string;
  contentId: string;
  itemId: string | null;
  response: Record<string, unknown>;
  createdAt: string;
};

export type Note = {
  noteId: string;
  itemId: string;
  author: Actor;
  content: string;
  createdAt: string;
  updatedAt: string;
};
