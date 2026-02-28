import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";

function now() {
  return new Date();
}
const hash = (v: string) => createHash("sha256").update(v).digest("hex");

export async function ensureUser(email: string, name?: string): Promise<{ id: string; email: string }> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (existing) return existing;
  const id = randomUUID();
  const ts = new Date();
  await prisma.user.create({
    data: { id, email, name: name ?? null, createdAt: ts, updatedAt: ts },
  });
  return { id, email };
}

export async function requestMagicLink(email: string, name?: string): Promise<{ token: string; expiresAt: string }> {
  const user = await ensureUser(email, name);
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(now().getTime() + 1000 * 60 * 15);
  const ts = new Date();
  await prisma.magicLink.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      tokenHash: hash(token),
      expiresAt,
      createdAt: ts,
    },
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function consumeMagicLink(token: string): Promise<string> {
  const tokenHash = hash(token);
  const row = await prisma.magicLink.findFirst({ where: { tokenHash } });
  if (!row) throw new Error("INVALID_TOKEN");
  if (row.consumedAt) throw new Error("ALREADY_USED");
  if (row.expiresAt < now()) throw new Error("EXPIRED");
  await prisma.magicLink.update({ where: { id: row.id }, data: { consumedAt: now() } });
  const sid = randomUUID();
  const expires = new Date(now().getTime() + 1000 * 60 * 60 * 24 * 14);
  await prisma.session.create({
    data: { id: sid, userId: row.userId, expiresAt: expires, createdAt: new Date() },
  });
  return sid;
}

export async function createSessionForUser(userId: string): Promise<string> {
  const sid = randomUUID();
  const expires = new Date(now().getTime() + 1000 * 60 * 60 * 24 * 14);
  await prisma.session.create({
    data: { id: sid, userId, expiresAt: expires, createdAt: new Date() },
  });
  return sid;
}

export async function destroySession(sessionId?: string): Promise<void> {
  if (!sessionId) return;
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function getUserFromSession(sessionId?: string): Promise<{ id: string; email: string } | null> {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.expiresAt < now()) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });
  return user ?? null;
}

export async function updateUser(
  userId: string,
  data: { email?: string; name?: string }
): Promise<{ id: string; email: string }> {
  const ts = new Date();
  const updateData: { updatedAt: Date; email?: string; name?: string } = { updatedAt: ts };
  if (data.email !== undefined) updateData.email = data.email;
  if (data.name !== undefined) updateData.name = data.name;
  await prisma.user.update({ where: { id: userId }, data: updateData });
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true },
  });
  return row;
}

/** Request an email change: stores pending new_email and returns token for magic link (production verification). */
export async function requestEmailChange(
  userId: string,
  currentEmail: string,
  newEmail: string
): Promise<{ token: string; expiresAt: string } | null> {
  const normalizedNew = newEmail.trim().toLowerCase();
  const normalizedCurrent = currentEmail.trim().toLowerCase();
  if (normalizedNew === normalizedCurrent) return null;
  const existing = await prisma.user.findUnique({ where: { email: normalizedNew }, select: { id: true } });
  if (existing) return null;

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(now().getTime() + 1000 * 60 * 15);
  const ts = new Date();
  await prisma.emailChangeRequest.deleteMany({ where: { userId } });
  await prisma.emailChangeRequest.create({
    data: {
      id: randomUUID(),
      userId,
      newEmail: normalizedNew,
      tokenHash: hash(token),
      expiresAt,
      createdAt: ts,
    },
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

/** Consume email-change token and update user email. Returns updated user or throws. */
export async function confirmEmailChange(token: string): Promise<{ id: string; email: string }> {
  const tokenHash = hash(token);
  const row = await prisma.emailChangeRequest.findFirst({ where: { tokenHash } });
  if (!row) throw new Error("INVALID_TOKEN");
  if (row.expiresAt < now()) throw new Error("EXPIRED");

  const ts = new Date();
  await prisma.user.update({
    where: { id: row.userId },
    data: { email: row.newEmail, updatedAt: ts },
  });
  await prisma.emailChangeRequest.delete({ where: { id: row.id } });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: row.userId },
    select: { id: true, email: true },
  });
  return user;
}
