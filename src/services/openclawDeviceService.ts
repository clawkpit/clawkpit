import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { createKey } from "./apiKeyService";
import { consumeRateLimit } from "./rateLimit";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEGMENT_LEN = 4;
const EXPIRY_MINUTES = 10;
const POLL_INTERVAL_MS = 3000;
const CONFIRM_RATE_LIMIT = 10;
const CONFIRM_WINDOW_MS = 10 * 60 * 1000;

function randomSegment(): string {
  let s = "";
  const bytes = randomBytes(SEGMENT_LEN);
  for (let i = 0; i < SEGMENT_LEN; i++) s += CHARS[bytes[i]! % CHARS.length];
  return s;
}

function generateDisplayCode(): string {
  return [randomSegment(), randomSegment()].join("-");
}

function now(): Date {
  return new Date();
}

export async function deviceStart(
  email: string
): Promise<{ display_code: string; device_code: string; expires_at: string }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  const deviceCode = randomBytes(24).toString("hex");
  const displayCode = generateDisplayCode();
  const expiresAt = new Date(now().getTime() + EXPIRY_MINUTES * 60 * 1000);
  const id = randomUUID();
  const ts = now();

  await prisma.openclawDevice.create({
    data: {
      id,
      deviceCode,
      displayCode,
      email: normalized,
      status: "pending",
      expiresAt,
      createdAt: ts,
    },
  });

  return {
    display_code: displayCode,
    device_code: deviceCode,
    expires_at: expiresAt.toISOString(),
  };
}

export async function deviceConfirm(displayCode: string, userId: string): Promise<void> {
  const row = await prisma.openclawDevice.findFirst({
    where: { displayCode: displayCode.trim() },
  });

  if (!row) throw new Error("INVALID_CODE");
  if (row.status !== "pending") throw new Error("CODE_ALREADY_USED");
  if (row.expiresAt < now()) throw new Error("CODE_EXPIRED");

  const { id: keyId, key } = await createKey(userId, "OpenClaw device");

  await prisma.openclawDevice.update({
    where: { id: row.id },
    data: { userId, apiKeyId: keyId, apiToken: key, status: "authorized" },
  });
}

export async function devicePoll(
  deviceCode: string
): Promise<{ status: "pending" } | { status: "authorized"; api_token: string }> {
  const row = await prisma.openclawDevice.findFirst({
    where: { deviceCode },
  });

  if (!row) throw new Error("INVALID_DEVICE_CODE");
  if (row.expiresAt < now()) throw new Error("EXPIRED");

  if (row.status === "pending") return { status: "pending" };
  if (row.status === "authorized" && row.apiToken) {
    await prisma.openclawDevice.update({
      where: { id: row.id },
      data: { status: "consumed", apiToken: null },
    });
    return { status: "authorized", api_token: row.apiToken };
  }
  throw new Error("ALREADY_CONSUMED");
}

export function consumeConfirmRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  return consumeRateLimit(`openclaw_confirm:${ip}`, CONFIRM_RATE_LIMIT, CONFIRM_WINDOW_MS);
}

export function consumePollRateLimit(deviceCode: string): { allowed: boolean; retryAfterSec: number } {
  return consumeRateLimit(`openclaw_poll:${deviceCode}`, 1, POLL_INTERVAL_MS);
}
