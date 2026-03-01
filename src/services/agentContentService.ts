import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import type { AgentContent, AgentContentType, FormResponse, Tag } from "../domain/types";
import { createItem, getItem, markDone } from "./itemService";
import type { Prisma } from "@prisma/client";

function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/** Extract first # H1 line from markdown for use as title. */
function deriveTitleFromMarkdown(markdown: string): string {
  const match = markdown.trim().match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function mapContent(r: {
  id: string;
  userId: string;
  type: string;
  title: string | null;
  body: string;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AgentContent {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type as AgentContent["type"],
    title: r.title,
    body: r.body,
    externalId: r.externalId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapFormResponse(r: {
  id: string;
  userId: string;
  contentId: string;
  itemId: string | null;
  response: string;
  createdAt: Date;
}): FormResponse {
  return {
    id: r.id,
    userId: r.userId,
    contentId: r.contentId,
    itemId: r.itemId,
    response: JSON.parse(r.response) as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
  };
}

type TxClient = Prisma.TransactionClient;

/**
 * Shared upsert logic for both markdown and form content.
 * Wrapped in a transaction to prevent races on concurrent calls with the same externalId/hash.
 */
async function upsertContent(
  userId: string,
  contentType: AgentContentType,
  tag: Tag,
  payload: { title?: string; body: string; externalId?: string }
): Promise<{ contentId: string; itemId: string }> {
  const body = payload.body;
  const contentHash = hashBody(body);
  const title = payload.title?.trim() || deriveTitleFromMarkdown(body);

  const contentId = await prisma.$transaction(async (tx: TxClient) => {
    const existing = await tx.agentContent.findFirst({
      where: payload.externalId
        ? { userId, externalId: payload.externalId }
        : { userId, contentHash, type: contentType },
    });

    if (existing) {
      await tx.agentContent.update({
        where: { id: existing.id },
        data: { body, title: title || null, updatedAt: new Date() },
      });
      const existingItem = await tx.item.findFirst({
        where: contentType === "form"
          ? { userId, contentId: existing.id, status: "Active" }
          : { userId, contentId: existing.id },
        orderBy: { createdAt: "desc" },
      });
      if (existingItem) {
        return { id: existing.id, existingItemId: existingItem.id };
      }
      return { id: existing.id, existingItemId: null };
    }

    const id = randomUUID();
    await tx.agentContent.create({
      data: {
        id,
        userId,
        type: contentType,
        title: title || null,
        body,
        externalId: payload.externalId ?? null,
        contentHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return { id, existingItemId: null };
  });

  if (contentId.existingItemId) {
    return { contentId: contentId.id, itemId: contentId.existingItemId };
  }

  const item = await createItem(userId, {
    title,
    description: "",
    tag,
    urgency: "Unclear",
    importance: "Medium",
    status: "Active",
    createdBy: "AI",
    contentId: contentId.id,
  });
  return { contentId: contentId.id, itemId: item.id };
}

export async function upsertMarkdown(
  userId: string,
  payload: { title?: string; markdown: string; externalId?: string }
): Promise<{ markdownId: string; itemId: string }> {
  const result = await upsertContent(userId, "markdown", "ToRead", {
    title: payload.title,
    body: payload.markdown,
    externalId: payload.externalId,
  });
  return { markdownId: result.contentId, itemId: result.itemId };
}

export async function upsertForm(
  userId: string,
  payload: { title?: string; formMarkdown: string; externalId?: string }
): Promise<{ formId: string; itemId: string }> {
  const result = await upsertContent(userId, "form", "ToDo", {
    title: payload.title,
    body: payload.formMarkdown,
    externalId: payload.externalId,
  });
  return { formId: result.contentId, itemId: result.itemId };
}

export async function getContent(userId: string, id: string): Promise<AgentContent | null> {
  const row = await prisma.agentContent.findFirst({ where: { id, userId } });
  return row ? mapContent(row) : null;
}

export async function submitFormResponse(
  userId: string,
  contentId: string,
  itemId: string | undefined,
  responseJson: Record<string, unknown>
): Promise<string> {
  const content = await prisma.agentContent.findFirst({ where: { id: contentId, userId } });
  if (!content) throw new Error("NOT_FOUND");
  if (content.type !== "form") throw new Error("NOT_A_FORM");

  const id = randomUUID();
  await prisma.formResponse.create({
    data: {
      id,
      userId,
      contentId,
      itemId: itemId ?? null,
      response: JSON.stringify(responseJson),
      createdAt: new Date(),
    },
  });

  if (itemId) {
    const item = await getItem(userId, itemId);
    if (item) await markDone(userId, itemId, "User");
  }

  return id;
}

export async function getFormResponses(userId: string, contentId: string): Promise<FormResponse[]> {
  const content = await prisma.agentContent.findFirst({ where: { id: contentId, userId } });
  if (!content) throw new Error("NOT_FOUND");

  const rows = await prisma.formResponse.findMany({
    where: { contentId, userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapFormResponse);
}
