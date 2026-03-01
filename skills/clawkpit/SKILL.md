---
name: clawkpit
description: Manage Clawkpit tasks and focus as the user's second brain and personal assistant. Sync from email, calendar, and other sources; respect Done/Dropped; suggest next steps, briefs, meeting prep, and planning. Use when the user explicitly mentions Clawkpit or asks to review, update, sync, or prioritize their Clawkpit board, inbox, focus, briefs, or task notes.
---

# Clawkpit

Act as the user's second brain and personal assistant for Clawkpit. Keep the board accurate and useful, respect Done and Dropped decisions, suggest next steps, and support briefs, meeting prep, and deadline-based planning.

## Use the API reference

Read [api.md](api.md) for base URL, auth, device flow, endpoints, enums, and error shapes.

Never ask the user to paste API keys or tokens in chat. Never print or log tokens, device codes, or secret values.

## Commands

Handle the slash command `/clawkpit`. Parse the raw args for the subcommand and optional flags.

- **connect**: If a token is already stored, report that the user is already connected and suggest `/clawkpit status`. Otherwise parse an optional email from `/clawkpit connect [email]`; if absent, ask for the account email. Start the device flow, show only the display code and URL, poll until authorized, store the returned token locally, and confirm success without echoing any secret.
- **status**: Call `GET /api/me` with the stored token. Report the connected account without printing the token. If auth fails, direct the user to `/clawkpit connect`.
- **install**: Direct the user to `https://your-clawkpit-instance.example.com/openclaw.md`.
- **inbox**: List active items. Return a short summary and a compact list with id, title, deadline, and status.
- **today**: List active items due today or overdue. Return a short summary and a compact list.
- **add**: Parse a title plus optional `due:YYYY-MM-DD`, `tag:ToDo|ToRead|ToThinkAbout|ToUse`, and `prio:High|Medium|Low`. Create the item and return the created id and title.
- **done**: Parse the item id. Use the API key so the action is recorded as `AI` (or send `{ "actor": "AI" }` explicitly). For `ToThinkAbout` items, ensure at least one note exists first.
- **drop**: Parse the item id and optional note. Use the API key so the action is recorded as `AI` (or send `{ "actor": "AI" }` explicitly). If the item has no notes, add one first.
- **focus**: List active items, prioritize nearest deadlines and higher importance, and suggest the single best next task with a short rationale.
- **sync**: Read items and notes as needed, then add or update items based on available context such as calendar or email. Use `POST /api/v1/items/batch` when batching several creates or updates is cleaner. Return a 1 to 3 line summary.

## Archive awareness

- When the user marks an item Done, suggest a logical next step or ask whether to create a follow-up item.
- When the user marks an item Dropped, do not resurrect it. Suggest an alternative only if it is genuinely distinct.

## Proactive behavior

When email, calendar, or other context is available:

- Add items that are clearly actionable or worth tracking.
- Prepare daily or weekly briefs covering active, overdue, due soon, recently done, and recently dropped items.
- Summarize relevant items and notes before meetings.
- Add AI-authored notes when useful, but do not try to edit existing notes as AI.

## Agent content

Use the agent content endpoints when the useful output is richer than a plain task:

- Push long-form reading material with `POST /api/agent/markdown`. This creates or updates a linked `ToRead` item.
- Push fillable workflows or checklists with `POST /api/agent/form`. This creates or updates a linked `ToDo` item.
- Forms are for the human to complete in Clawkpit. Do not submit form responses as the agent.
- For recurring syncs, send a stable `externalId` so repeated runs update the existing linked content instead of creating duplicates.
- Derive `externalId` from the source system's own durable identifier, for example `gmail:thread:<id>`, `calendar:event:<id>`, `notion:page:<id>`, or `github:issue:<repo>:<number>`.
- Keep the same `externalId` when the same logical document or form changes. Changing the `externalId` creates a new linked content record.
- Do not derive `externalId` from mutable text such as the current title or body.
- Omit `externalId` for one-off content where body-hash deduplication is sufficient.

## Response format

Return a short summary first, then a compact list of tasks when relevant. Do not dump raw JSON unless the user explicitly asks for it.

## Heartbeat (recommended)

If the user uses a heartbeat or periodic task, suggest a Clawkpit check that lists active work, highlights urgent deadlines, and returns a focus suggestion with a brief summary. Do not edit their config automatically; provide a snippet they can add.
