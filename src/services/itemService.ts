import { prisma } from "../db/prisma";
import { randomUUID } from "node:crypto";
import { Item, Note } from "../domain/types";

function now(): string {
  return new Date().toISOString();
}

function mapItem(r: {
  id: string;
  humanId: number;
  userId: string;
  title: string;
  description: string;
  urgency: string;
  tag: string;
  importance: string;
  deadline: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  openedAt: Date;
  createdBy: string;
  modifiedBy: string;
}): Item {
  return {
    id: r.id,
    humanId: r.humanId,
    userId: r.userId,
    title: r.title,
    description: r.description,
    urgency: r.urgency as Item["urgency"],
    tag: r.tag as Item["tag"],
    importance: r.importance as Item["importance"],
    deadline: r.deadline,
    status: r.status as Item["status"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    openedAt: r.openedAt.toISOString(),
    createdBy: r.createdBy as Item["createdBy"],
    modifiedBy: r.modifiedBy as Item["modifiedBy"],
    hasAIChanges: false,
  };
}

function mapNote(r: { id: string; itemId: string; author: string; content: string; createdAt: Date; updatedAt: Date }): Note {
  return {
    noteId: r.id,
    itemId: r.itemId,
    author: r.author as Note["author"],
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function nextHumanId(userId: string): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    const row = await tx.userCounter.findUnique({ where: { userId } });
    if (!row) {
      await tx.userCounter.create({ data: { userId, nextHumanId: 2 } });
      return 1;
    }
    await tx.userCounter.update({
      where: { userId },
      data: { nextHumanId: row.nextHumanId + 1 },
    });
    return row.nextHumanId;
  });
}

export async function createItem(userId: string, payload: any): Promise<Item> {
  const ts = new Date();
  const id = randomUUID();
  const humanId = await nextHumanId(userId);
  await prisma.item.create({
    data: {
      id,
      humanId,
      userId,
      title: payload.title,
      description: payload.description ?? "",
      urgency: payload.urgency ?? "Unclear",
      tag: payload.tag ?? "ToDo",
      importance: payload.importance ?? "Medium",
      deadline: payload.deadline ?? null,
      status: "Active",
      createdAt: ts,
      updatedAt: ts,
      openedAt: ts,
      createdBy: payload.createdBy ?? "User",
      modifiedBy: payload.createdBy ?? "User",
    },
  });
  const item = await getItem(userId, id);
  if (!item) throw new Error("create_item_failed");
  return item;
}

export async function getItem(userId: string, id: string): Promise<Item | null> {
  const row = await prisma.item.findFirst({ where: { id, userId } });
  return row ? mapItem(row) : null;
}

export async function listItems(
  userId: string,
  query: any
): Promise<{ items: Item[]; total: number }> {
  const where: any = { userId };
  if (query.status && query.status !== "All") where.status = query.status;
  if (query.tag) where.tag = query.tag;
  if (query.importance) where.importance = query.importance;
  if (query.modifiedBy) where.modifiedBy = query.modifiedBy;
  if (query.createdBy) where.createdBy = query.createdBy;
  if (query.urgency) where.urgency = query.urgency;
  if (query.deadlineBefore || query.deadlineAfter) {
    const deadlineFilter: { not?: null; lt?: string; gt?: string } = { not: null as any };
    if (query.deadlineBefore) deadlineFilter.lt = query.deadlineBefore;
    if (query.deadlineAfter) deadlineFilter.gt = query.deadlineAfter;
    where.deadline = deadlineFilter;
  }

  const [total, allRows] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({ where }),
  ]);

  const importanceOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  allRows.sort((a, b) => {
    const aNull = a.deadline == null ? 1 : 0;
    const bNull = b.deadline == null ? 1 : 0;
    if (aNull !== bNull) return aNull - bNull;
    if (a.deadline != null && b.deadline != null && a.deadline !== b.deadline) {
      return a.deadline < b.deadline ? -1 : 1;
    }
    const ai = importanceOrder[a.importance] ?? 2;
    const bi = importanceOrder[b.importance] ?? 2;
    if (ai !== bi) return ai - bi;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const start = (query.page - 1) * query.pageSize;
  const rows = allRows.slice(start, start + query.pageSize);
  return { items: rows.map(mapItem), total };
}

export async function patchItem(userId: string, id: string, payload: any): Promise<Item | null> {
  const current = await getItem(userId, id);
  if (!current) return null;
  const merged = {
    ...current,
    ...payload,
    modifiedBy: (payload.modifiedBy ?? current.modifiedBy) as string,
    updatedAt: now(),
  };
  await prisma.item.update({
    where: { id },
    data: {
      title: merged.title,
      description: merged.description,
      urgency: merged.urgency,
      tag: merged.tag,
      importance: merged.importance,
      deadline: merged.deadline,
      status: merged.status,
      openedAt: new Date(merged.openedAt),
      updatedAt: new Date(merged.updatedAt),
      modifiedBy: merged.modifiedBy,
    },
  });
  return getItem(userId, id);
}

export async function addNote(userId: string, itemId: string, payload: any): Promise<Note> {
  const item = await getItem(userId, itemId);
  if (!item) throw new Error("NOT_FOUND");
  const ts = new Date();
  const id = randomUUID();
  await prisma.note.create({
    data: {
      id,
      itemId,
      author: payload.author,
      content: payload.content,
      createdAt: ts,
      updatedAt: ts,
    },
  });
  await prisma.item.update({
    where: { id: itemId },
    data: { updatedAt: ts, modifiedBy: payload.author },
  });
  const row = await prisma.note.findUniqueOrThrow({ where: { id } });
  return mapNote(row);
}

export async function listNotes(userId: string, itemId: string): Promise<Note[]> {
  const item = await getItem(userId, itemId);
  if (!item) throw new Error("NOT_FOUND");
  const rows = await prisma.note.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapNote);
}

export async function updateNote(
  userId: string,
  noteId: string,
  actor: string,
  content: string
): Promise<Note> {
  const row = await prisma.note.findFirst({
    where: { id: noteId },
    include: { item: true },
  });
  if (!row || row.item.userId !== userId) throw new Error("NOT_FOUND");
  if (actor === "AI") throw new Error("AI_EDIT_FORBIDDEN");
  const ts = new Date();
  await prisma.note.update({ where: { id: noteId }, data: { content, updatedAt: ts } });
  await prisma.item.update({
    where: { id: row.itemId },
    data: { updatedAt: ts, modifiedBy: actor },
  });
  const updated = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
  return mapNote(updated);
}

async function noteCount(itemId: string): Promise<number> {
  return await prisma.note.count({ where: { itemId } });
}

export async function markDone(userId: string, itemId: string, actor: string): Promise<Item> {
  const item = await getItem(userId, itemId);
  if (!item) throw new Error("NOT_FOUND");
  if (item.tag === "ToThinkAbout" && (await noteCount(itemId)) === 0)
    throw new Error("DONE_NOTE_REQUIRED");
  const ts = new Date();
  await prisma.item.update({
    where: { id: itemId },
    data: { status: "Done", updatedAt: ts, modifiedBy: actor },
  });
  const updated = await getItem(userId, itemId);
  if (!updated) throw new Error("NOT_FOUND");
  return updated;
}

export async function dropItem(
  userId: string,
  itemId: string,
  actor: string,
  note?: string
): Promise<Item> {
  const item = await getItem(userId, itemId);
  if (!item) throw new Error("NOT_FOUND");
  if (note) await addNote(userId, itemId, { author: actor, content: note });
  if ((await noteCount(itemId)) === 0) throw new Error("DROP_NOTE_REQUIRED");
  const ts = new Date();
  await prisma.item.update({
    where: { id: itemId },
    data: { status: "Dropped", updatedAt: ts, modifiedBy: actor },
  });
  const updated = await getItem(userId, itemId);
  if (!updated) throw new Error("NOT_FOUND");
  return updated;
}
