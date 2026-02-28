# Clawkpit API reference

Base URL: use `CLAWKPIT_BASE_URL` from environment or config (e.g. `https://your-clawkpit-instance.example.com` for self-hosted). All paths below are relative to the base (e.g. base + `/api/me`).

## Authentication (items and notes)

- **Header**: `Authorization: Bearer <API_KEY>` or `X-API-Key: <API_KEY>`
- Token is obtained via the **device flow** (`/clawkpit connect`) and stored by the skill, or from env `CLAWKPIT_API_TOKEN` or OpenClaw config `skills.entries.clawkpit.env.CLAWKPIT_API_TOKEN`.
- Never log or echo the token.

## Device flow (connect without pasting secrets)

No auth for start and poll; confirm requires a **logged-in session** (cookie).

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/openclaw/device/start` | None | `{ "email": "user@example.com" }` | `{ "display_code": "XXXX-XXXX", "device_code": "<opaque>", "expires_at": "<ISO>" }`. 404 if no account for email. |
| POST | `/api/openclaw/device/confirm` | **Session only** (cookie) | `{ "display_code": "XXXX-XXXX" }` | `{ "ok": true, "message": "OpenClaw connected." }`. 401 if not signed in; 404/400 if invalid or expired code. |
| POST | `/api/openclaw/device/poll` | None | `{ "device_code": "<from start>" }` | `{ "status": "pending" }` or `{ "status": "authorized", "api_token": "<key>" }`. 410 when expired or already consumed. Poll rate-limited per device_code. |

- Codes expire in 10 minutes. Display code is one-time use; after returning `api_token` once, the device is consumed.
- Agent must show only `display_code` and the Clawkpit URL to the user; store `api_token` locally and never print it.

## Identity

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Returns `{ "user": { "id", "email", "name?" } }`. Requires auth. |

## Items

Enums: **urgency** DoNow | DoToday | DoThisWeek | DoLater | Unclear; **tag** ToRead | ToThinkAbout | ToUse | ToDo; **importance** High | Medium | Low; **status** Active | Done | Dropped; **actor** User | AI.

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| POST | `/api/v1/items` | `title` (required), `description?`, `urgency?`, `tag?`, `importance?`, `deadline?` (ISO or null), `status?`, `createdBy?` | 201 + full item. |
| GET | `/api/v1/items` | Query: `status` (Active\|Done\|Dropped\|All), `tag?`, `importance?`, `urgency?`, `deadlineBefore?`, `deadlineAfter?`, `createdBy?`, `modifiedBy?`, `page`, `pageSize` | `{ "items", "total", "page", "pageSize" }`. |
| GET | `/api/v1/items/:id` | — | Single item or 404. |
| PATCH | `/api/v1/items/:id` | Any of: `title`, `description`, `urgency`, `tag`, `importance`, `deadline`, `status`, `openedAt`, `modifiedBy` | Updated item or 404. |
| POST | `/api/v1/items/batch` | Array of `{ "action": "create" \| "update", "id?" (for update), "payload" }` | `{ "results": [ { "ok", "item?" \| "error?" } ] }`. |

## Notes

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/v1/items/:id/notes` | `{ "author": "User" \| "AI", "content": "..." }` | 201 + note. |
| GET | `/api/v1/items/:id/notes` | — | Array of notes. |
| PATCH | `/api/v1/notes/:noteId` | `{ "actor", "content" }` | **User only.** AI gets 403. Updated note or 404. |

## Item actions

| Method | Path | Body | Notes |
|--------|------|------|--------|
| POST | `/api/v1/items/:id/done` | `{ "actor": "User" \| "AI" }` | ToThinkAbout items require at least one note before marking done. |
| POST | `/api/v1/items/:id/drop` | `{ "actor", "note?" }` | Item must have at least one note (add one if needed). |

## Item shape

`id`, `humanId`, `userId`, `title`, `description`, `urgency`, `tag`, `importance`, `deadline` (ISO or null), `status`, `createdAt`, `updatedAt`, `openedAt`, `createdBy`, `modifiedBy`, `hasAIChanges?`.

## Note shape

`noteId`, `itemId`, `author`, `content`, `createdAt`, `updatedAt`.

## Error responses

Standard envelope: `{ "error": { "code", "message", "details" } }`. Codes include BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED.
