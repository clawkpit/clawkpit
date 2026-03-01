import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type {
  Item,
  ItemNote,
  ItemStatus,
  FilterState,
  ItemTag,
  ItemImportance,
  ItemColumn,
} from "@/types/items";
import {
  BACKEND_TO_TAG,
  BACKEND_TO_IMPORTANCE,
  TAG_TO_BACKEND,
  IMPORTANCE_TO_BACKEND,
} from "@/types/items";

export type User = { id: string; email: string; name?: string };

type AuthState = { user: User | null; loading: boolean; setUser: (u: User | null) => void };

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getMe()
      .then((u) => setUser(u))
      .finally(() => setLoading(false));
  }, []);
  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Request failed");
  return data as T;
}

export async function getMe(): Promise<User | null> {
  const r = await fetch("/api/me", { credentials: "include" });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("Failed to get user");
  const data = await r.json();
  return data.user;
}

export type UpdateMeResult =
  | { user: User; pendingEmailChange?: false }
  | { user: User; pendingEmailChange: true; message: string; expiresAt: string };

export async function updateMe(payload: { email?: string; name?: string }): Promise<UpdateMeResult> {
  const data = await apiFetch<UpdateMeResult>("/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data;
}

export type ApiKeyMeta = { id: string; name: string | null; createdAt: string };

export async function listApiKeys(): Promise<ApiKeyMeta[]> {
  const data = await apiFetch<{ keys?: ApiKeyMeta[] }>("/me/keys");
  return Array.isArray(data.keys) ? data.keys : [];
}

export async function createApiKey(params?: { name?: string }): Promise<{ id: string; key: string }> {
  const data = await apiFetch<{ id: string; key: string }>("/me/keys", {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  });
  if (typeof data?.key !== "string") {
    throw new Error("Server did not return an API key");
  }
  return { id: data.id ?? "", key: data.key };
}

export async function deleteApiKey(id: string): Promise<void> {
  const r = await fetch(`/api/me/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (r.status === 404) throw new Error("Not found");
  if (!r.ok) throw new Error("Request failed");
}

export async function requestMagicLink(email: string): Promise<{ token?: string; expiresAt?: string }> {
  const r = await fetch("/api/auth/request-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof data.error === "object" ? "Invalid request" : data.error || "Request failed");
  return data;
}

export async function consumeMagicLink(token: string): Promise<void> {
  await apiFetch("/auth/consume-link", { method: "POST", body: JSON.stringify({ token }) });
}

export async function confirmEmailChange(token: string): Promise<User> {
  const data = await apiFetch<{ user: User }>("/auth/confirm-email-change", {
    method: "POST",
    body: JSON.stringify({ token }),
    credentials: "include",
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function confirmOpenclawDevice(displayCode: string): Promise<{ ok: boolean; message?: string }> {
  const r = await fetch("/api/openclaw/device/confirm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_code: displayCode.trim() }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data.error?.message ?? data.message ?? "Request failed";
    throw new Error(msg);
  }
  return { ok: true, message: data.message };
}

function mapNote(raw: { noteId: string; content: string; author: string; createdAt: string; updatedAt: string }): ItemNote {
  return {
    id: raw.noteId,
    content: raw.content,
    author: raw.author as ItemNote["author"],
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function mapItem(raw: {
  id: string;
  humanId: number;
  title: string;
  description: string;
  urgency: string;
  tag: string;
  importance: string;
  deadline: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  modifiedBy: string;
  hasAIChanges: boolean;
  contentId?: string | null;
  contentType?: string | null;
}): Item {
  return {
    id: raw.id,
    humanId: raw.humanId,
    title: raw.title,
    description: raw.description,
    column: raw.urgency as ItemColumn,
    tag: BACKEND_TO_TAG[raw.tag] ?? (raw.tag as ItemTag),
    importance: BACKEND_TO_IMPORTANCE[raw.importance] ?? "M",
    deadline: raw.deadline ? new Date(raw.deadline) : undefined,
    status: raw.status as Item["status"],
    createdBy: raw.createdBy as Item["createdBy"],
    modifiedBy: raw.modifiedBy as Item["modifiedBy"],
    modifiedAt: new Date(raw.updatedAt),
    hasAIChanges: raw.hasAIChanges,
    contentId: raw.contentId ?? undefined,
    contentType: (raw.contentType as Item["contentType"]) ?? undefined,
  };
}

export interface ListItemsQuery {
  status?: ItemStatus | "All";
  page?: number;
  pageSize?: number;
  tag?: ItemTag;
  importance?: FilterState["importance"];
  createdBy?: FilterState["createdBy"];
  modifiedBy?: FilterState["modifiedBy"];
}

export async function listItems(query: ListItemsQuery): Promise<{ items: Item[]; total: number }> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.page != null) params.set("page", String(query.page));
  if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query.tag) params.set("tag", TAG_TO_BACKEND[query.tag]);
  if (query.importance && query.importance !== "All") params.set("importance", IMPORTANCE_TO_BACKEND[query.importance]);
  if (query.createdBy && query.createdBy !== "All") params.set("createdBy", query.createdBy);
  if (query.modifiedBy && query.modifiedBy !== "All") params.set("modifiedBy", query.modifiedBy);
  const data = await apiFetch<{ items: unknown[]; total: number }>(`/v1/items?${params}`);
  return { items: data.items.map((i) => mapItem(i as Parameters<typeof mapItem>[0])), total: data.total };
}

export async function getItem(id: string): Promise<Item> {
  const raw = await apiFetch<Parameters<typeof mapItem>[0]>(`/v1/items/${id}`);
  return mapItem(raw);
}

export interface CreateItemPayload {
  title: string;
  description?: string;
  tag?: ItemTag;
  column?: ItemColumn;
  importance?: ItemImportance;
  deadline?: Date | null;
  status?: Item["status"];
  createdBy?: Item["createdBy"];
}

export async function createItem(payload: CreateItemPayload): Promise<Item> {
  const body = {
    title: payload.title,
    description: payload.description ?? "",
    tag: payload.tag ? TAG_TO_BACKEND[payload.tag] : "ToDo",
    urgency: payload.column ?? "Unclear",
    importance: payload.importance ? IMPORTANCE_TO_BACKEND[payload.importance] : "Medium",
    deadline: payload.deadline ? payload.deadline.toISOString() : null,
    status: payload.status ?? "Active",
    createdBy: payload.createdBy ?? "User",
  };
  const raw = await apiFetch<Parameters<typeof mapItem>[0]>("/v1/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapItem(raw);
}

export interface UpdateItemPayload {
  title?: string;
  description?: string;
  tag?: ItemTag;
  column?: ItemColumn;
  importance?: ItemImportance;
  deadline?: Date | null;
  status?: Item["status"];
  modifiedBy?: Item["modifiedBy"];
  hasAIChanges?: boolean;
}

export async function updateItem(id: string, payload: UpdateItemPayload): Promise<Item> {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.tag !== undefined) body.tag = TAG_TO_BACKEND[payload.tag];
  if (payload.column !== undefined) body.urgency = payload.column;
  if (payload.importance !== undefined) body.importance = IMPORTANCE_TO_BACKEND[payload.importance];
  if (payload.deadline !== undefined) body.deadline = payload.deadline ? payload.deadline.toISOString() : null;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.modifiedBy !== undefined) body.modifiedBy = payload.modifiedBy;
  if (payload.hasAIChanges !== undefined) body.hasAIChanges = payload.hasAIChanges;
  const raw = await apiFetch<Parameters<typeof mapItem>[0]>(`/v1/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return mapItem(raw);
}

export async function listNotes(itemId: string): Promise<ItemNote[]> {
  const raw = await apiFetch<{ noteId: string; content: string; author: string; createdAt: string; updatedAt: string }[]>(
    `/v1/items/${itemId}/notes`
  );
  return Array.isArray(raw) ? raw.map(mapNote) : [];
}

export async function addNote(itemId: string, content: string, author: ItemNote["author"] = "User"): Promise<ItemNote> {
  const raw = await apiFetch<{ noteId: string; content: string; author: string; createdAt: string; updatedAt: string }>(
    `/v1/items/${itemId}/notes`,
    { method: "POST", body: JSON.stringify({ author, content }) }
  );
  return mapNote(raw);
}

export async function updateNote(noteId: string, content: string, actor: ItemNote["author"] = "User"): Promise<ItemNote> {
  const raw = await apiFetch<{ noteId: string; content: string; author: string; createdAt: string; updatedAt: string }>(
    `/v1/notes/${noteId}`,
    { method: "PATCH", body: JSON.stringify({ actor, content }) }
  );
  return mapNote(raw);
}

export async function markDone(itemId: string, actor: Item["modifiedBy"] = "User"): Promise<Item> {
  const raw = await apiFetch<Parameters<typeof mapItem>[0]>(`/v1/items/${itemId}/done`, {
    method: "POST",
    body: JSON.stringify({ actor }),
  });
  return mapItem(raw);
}

export async function dropItem(itemId: string, actor: Item["modifiedBy"] = "User", note?: string): Promise<Item> {
  const raw = await apiFetch<Parameters<typeof mapItem>[0]>(`/v1/items/${itemId}/drop`, {
    method: "POST",
    body: JSON.stringify({ actor, note }),
  });
  return mapItem(raw);
}

export interface MarkdownContent {
  id: string;
  title: string | null;
  markdown: string;
  createdAt: string;
}

export async function getMarkdownContent(id: string): Promise<MarkdownContent> {
  return apiFetch<MarkdownContent>(`/markdown/${id}`);
}

export interface FormContent {
  id: string;
  title: string | null;
  formMarkdown: string;
  createdAt: string;
}

export async function getFormContent(id: string): Promise<FormContent> {
  return apiFetch<FormContent>(`/forms/${id}`);
}

export interface FormResponseRecord {
  id: string;
  userId: string;
  contentId: string;
  itemId: string | null;
  response: Record<string, unknown>;
  createdAt: string;
}

export async function getFormResponses(id: string): Promise<FormResponseRecord[]> {
  const data = await apiFetch<{ responses?: FormResponseRecord[] }>(`/agent/forms/${id}/responses`);
  return Array.isArray(data.responses) ? data.responses : [];
}

export async function submitFormResponse(
  formId: string,
  payload: { itemId?: string; response: Record<string, unknown> }
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/forms/${formId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
