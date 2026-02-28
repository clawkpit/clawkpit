import { Router } from "express";
import {
  batchSchema,
  confirmEmailChangeSchema,
  consumeMagicLinkSchema,
  createApiKeySchema,
  createItemSchema,
  createNoteSchema,
  doneSchema,
  dropSchema,
  listItemsQuerySchema,
  openclawDeviceConfirmSchema,
  openclawDevicePollSchema,
  openclawDeviceStartSchema,
  patchNoteSchema,
  requestMagicLinkSchema,
  updateItemSchema,
  updateMeSchema,
  uuidParam
} from "../services/validation";
import {
  confirmEmailChange,
  consumeMagicLink,
  createSessionForUser,
  destroySession,
  getUserFromSession,
  requestEmailChange,
  requestMagicLink,
  updateUser
} from "../services/authService";
import { consumeRateLimit } from "../services/rateLimit";
import { getUserByKey, createKey, listKeys, deleteKey } from "../services/apiKeyService";
import {
  deviceStart,
  deviceConfirm,
  devicePoll,
  consumeConfirmRateLimit,
  consumePollRateLimit
} from "../services/openclawDeviceService";
import { addNote, createItem, dropItem, getItem, listItems, listNotes, markDone, patchItem, updateNote } from "../services/itemService";
import { sendApiError, ApiErrorCode } from "../services/apiError";
import {
  canSendMagicLinkEmail,
  sendEmailChangeVerificationEmail,
  sendMagicLinkEmail
} from "../services/emailService";

export const api = Router();

const MAGIC_LINK_LIMIT = 5;
const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CROSS_ORIGIN_CORS = Boolean(process.env.CORS_ORIGIN);

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: CROSS_ORIGIN_CORS && IS_PRODUCTION ? ("none" as const) : ("lax" as const),
    secure: CROSS_ORIGIN_CORS && IS_PRODUCTION ? true : IS_PRODUCTION,
    path: "/",
    maxAge: 14 * 24 * 60 * 60 * 1000
  };
}

api.post("/auth/request-link", async (req, res) => {
  const parsed = requestMagicLinkSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);

  const key = `${req.ip}:${parsed.data.email.toLowerCase()}`;
  const rate = consumeRateLimit(key, MAGIC_LINK_LIMIT, MAGIC_LINK_WINDOW_MS);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return sendApiError(res, 429, ApiErrorCode.RATE_LIMITED, "Too many magic link requests. Please wait before trying again.");
  }

  const result = await requestMagicLink(parsed.data.email, parsed.data.name);
  if (!IS_PRODUCTION) {
    return res.json({ message: "Magic link generated", token: result.token, expiresAt: result.expiresAt });
  }

  if (canSendMagicLinkEmail()) {
    const sendResult = await sendMagicLinkEmail(parsed.data.email, result.token, result.expiresAt);
    if (!sendResult.ok) console.error("[magic-link] send failed:", sendResult.error);
  }
  return res.json({ message: "If this email exists, a magic link has been sent.", expiresAt: result.expiresAt });
});

api.post("/auth/consume-link", async (req, res) => {
  const parsed = consumeMagicLinkSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try {
    const sessionId = await consumeMagicLink(parsed.data.token);
    res.cookie("session", sessionId, cookieOptions());
    return res.json({ ok: true });
  } catch {
    return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid or expired token");
  }
});

api.post("/auth/logout", async (req, res) => {
  await destroySession(req.cookies.session);
  res.clearCookie("session", cookieOptions());
  return res.json({ ok: true });
});

api.post("/auth/confirm-email-change", async (req, res) => {
  const parsed = confirmEmailChangeSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try {
    const user = await confirmEmailChange(parsed.data.token);
    const sessionId = await createSessionForUser(user.id);
    res.cookie("session", sessionId, cookieOptions());
    return res.json({ ok: true, user });
  } catch (e: any) {
    if (e.message === "INVALID_TOKEN") return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid or expired link");
    if (e.message === "EXPIRED") return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Verification link has expired");
    throw e;
  }
});

// OpenClaw device flow (no auth for start/poll; confirm requires session only)
api.post("/openclaw/device/start", async (req, res) => {
  const parsed = openclawDeviceStartSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try {
    const result = await deviceStart(parsed.data.email);
    return res.json(result);
  } catch (e: any) {
    if (e.message === "USER_NOT_FOUND") return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "No account found for this email.");
    throw e;
  }
});

api.post("/openclaw/device/poll", async (req, res) => {
  const parsed = openclawDevicePollSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);

  const rate = consumePollRateLimit(parsed.data.device_code);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return sendApiError(res, 429, ApiErrorCode.RATE_LIMITED, "Poll too frequently. Wait before retrying.");
  }

  try {
    const result = await devicePoll(parsed.data.device_code);
    if (result.status === "pending") return res.json(result);
    return res.json(result);
  } catch (e: any) {
    if (e.message === "INVALID_DEVICE_CODE") return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Invalid or unknown device code.");
    if (e.message === "EXPIRED") return res.status(410).json({ error: "Code expired. Start a new connection." });
    if (e.message === "ALREADY_CONSUMED") return res.status(410).json({ error: "Token already received. Use your stored token." });
    throw e;
  }
});

api.post("/openclaw/device/confirm", async (req, res) => {
  const sessionUser = await getUserFromSession(req.cookies?.session);
  if (!sessionUser) return sendApiError(res, 401, ApiErrorCode.UNAUTHORIZED, "Sign in to connect OpenClaw. Session required.");

  const ip = (req as any).ip || req.socket?.remoteAddress || "unknown";
  const rate = consumeConfirmRateLimit(ip);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return sendApiError(res, 429, ApiErrorCode.RATE_LIMITED, "Too many attempts. Wait before trying again.");
  }

  const parsed = openclawDeviceConfirmSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);

  try {
    await deviceConfirm(parsed.data.display_code, sessionUser.id);
    return res.json({ ok: true, message: "OpenClaw connected." });
  } catch (e: any) {
    if (e.message === "INVALID_CODE") return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Invalid or unknown code.");
    if (e.message === "CODE_ALREADY_USED") return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "This code was already used.");
    if (e.message === "CODE_EXPIRED") return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Code expired. Start a new connection from your agent.");
    throw e;
  }
});

api.use(async (req, res, next) => {
  const token =
    (typeof req.headers.authorization === "string" && req.headers.authorization.replace(/^Bearer\s+/i, "").trim()) ||
    (typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"].trim() : undefined);
  if (token) {
    const user = await getUserByKey(token);
    if (user) {
      (req as any).user = user;
      return next();
    }
  }
  const user = await getUserFromSession(req.cookies?.session);
  if (!user) return sendApiError(res, 401, ApiErrorCode.UNAUTHORIZED, "Unauthorized");
  (req as any).user = user;
  next();
});

api.get("/me", (req, res) => res.json({ user: (req as any).user }));

api.patch("/me", async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  const currentUser = (req as any).user as { id: string; email: string };
  const userId = currentUser.id;

  if (IS_PRODUCTION && parsed.data.email !== undefined && parsed.data.email.trim().toLowerCase() !== currentUser.email.trim().toLowerCase()) {
    const result = await requestEmailChange(userId, currentUser.email, parsed.data.email);
    if (!result) {
      return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Cannot use that email (same as current or already taken)");
    }
    if (canSendMagicLinkEmail()) {
      const sendResult = await sendEmailChangeVerificationEmail(parsed.data.email.trim(), result.token, result.expiresAt);
      if (!sendResult.ok) console.error("[email-change] send failed:", sendResult.error);
    }
    return res.json({
      user: currentUser,
      pendingEmailChange: true,
      message: "Verification email sent to the new address. Click the link there to confirm.",
      expiresAt: result.expiresAt
    });
  }

  const updated = await updateUser(userId, parsed.data);
  return res.json({ user: updated });
});

api.get("/me/keys", async (req, res) => {
  const keys = await listKeys((req as any).user.id);
  return res.json({ keys });
});

api.post("/me/keys", async (req, res) => {
  const parsed = createApiKeySchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  const result = await createKey((req as any).user.id, parsed.data.name);
  return res.status(201).json({ id: result.id, key: result.key });
});

api.delete("/me/keys/:id", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const deleted = await deleteKey((req as any).user.id, idParsed.data);
  if (!deleted) return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found");
  return res.status(204).send();
});

api.post("/v1/items", async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  const item = await createItem((req as any).user.id, parsed.data);
  return res.status(201).json(item);
});

api.get("/v1/items", async (req, res) => {
  const parsed = listItemsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  const result = await listItems((req as any).user.id, parsed.data);
  return res.json({ ...result, page: parsed.data.page, pageSize: parsed.data.pageSize });
});

api.get("/v1/items/:id", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const item = await getItem((req as any).user.id, idParsed.data);
  if (!item) return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found");
  return res.json(item);
});

api.patch("/v1/items/:id", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  const item = await patchItem((req as any).user.id, idParsed.data, parsed.data);
  if (!item) return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found");
  return res.json(item);
});

api.post("/v1/items/batch", async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  const userId = (req as any).user.id;
  const results = await Promise.all(
    parsed.data.map(async (op) => {
      if (op.action === "create") {
        const item = await createItem(userId, op.payload);
        return { ok: true as const, item };
      }
      const item = await patchItem(userId, op.id, op.payload);
      return item ? { ok: true as const, item } : { ok: false as const, error: "Not found" };
    })
  );
  res.json({ results });
});

api.post("/v1/items/:id/notes", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try { const note = await addNote((req as any).user.id, idParsed.data, parsed.data); return res.status(201).json(note); }
  catch { return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found"); }
});

api.get("/v1/items/:id/notes", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  try { const notes = await listNotes((req as any).user.id, idParsed.data); return res.json(notes); }
  catch { return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found"); }
});

api.patch("/v1/notes/:noteId", async (req, res) => {
  const noteIdParsed = uuidParam.safeParse(req.params.noteId);
  if (!noteIdParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const parsed = patchNoteSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try { const note = await updateNote((req as any).user.id, noteIdParsed.data, parsed.data.actor, parsed.data.content); return res.json(note); }
  catch (e: any) {
    if (e.message === "AI_EDIT_FORBIDDEN") return sendApiError(res, 403, ApiErrorCode.FORBIDDEN, "AI cannot edit existing notes");
    return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found");
  }
});

api.post("/v1/items/:id/done", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const parsed = doneSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try { const item = await markDone((req as any).user.id, idParsed.data, parsed.data.actor); return res.json(item); }
  catch (e: any) {
    if (e.message === "DONE_NOTE_REQUIRED") return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Add a note with your reflection before marking this item done.");
    return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found");
  }
});

api.post("/v1/items/:id/drop", async (req, res) => {
  const idParsed = uuidParam.safeParse(req.params.id);
  if (!idParsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Invalid ID format");
  const parsed = dropSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Validation failed", parsed.error.flatten() as Record<string, unknown>);
  try { const item = await dropItem((req as any).user.id, idParsed.data, parsed.data.actor, parsed.data.note); return res.json(item); }
  catch (e: any) {
    if (e.message === "DROP_NOTE_REQUIRED") return sendApiError(res, 400, ApiErrorCode.BAD_REQUEST, "Add a short note explaining why you are dropping this item.");
    return sendApiError(res, 404, ApiErrorCode.NOT_FOUND, "Not found");
  }
});
