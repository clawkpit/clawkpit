import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";

const keyHash = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createKey(
  userId: string,
  name?: string
): Promise<{ id: string; key: string }> {
  const id = randomUUID();
  const key = randomBytes(32).toString("hex");
  const ts = new Date();
  await prisma.apiKey.create({
    data: { id, userId, keyHash: keyHash(key), name: name ?? null, createdAt: ts },
  });
  return { id, key };
}

export async function getUserByKey(plainKey: string): Promise<{ id: string; email: string } | null> {
  const row = await prisma.apiKey.findFirst({
    where: { keyHash: keyHash(plainKey) },
    select: { user: { select: { id: true, email: true } } },
  });
  return row?.user ?? null;
}

export async function listKeys(
  userId: string
): Promise<{ id: string; name: string | null; createdAt: string }[]> {
  const rows = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteKey(userId: string, keyId: string): Promise<boolean> {
  const result = await prisma.apiKey.deleteMany({
    where: { id: keyId, userId },
  });
  return result.count > 0;
}
