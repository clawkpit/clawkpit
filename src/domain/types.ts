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
  /** Placeholder for future AI-change tracking; API always returns false for now */
  hasAIChanges?: boolean;
};

export type Note = {
  noteId: string;
  itemId: string;
  author: Actor;
  content: string;
  createdAt: string;
  updatedAt: string;
};
