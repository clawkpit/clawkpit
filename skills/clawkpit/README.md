# Clawkpit OpenClaw skill

This skill teaches an OpenClaw agent to act as your second brain and personal assistant for [Clawkpit](https://github.com/clawkpit/clawkpit): manage tasks, sync from email and calendar, respect Done/Dropped, and support briefs, meeting prep, and planning.

## Install

**Preferred**: Set `CLAWKPIT_BASE_URL` to your Clawkpit instance (e.g. `https://your-clawkpit-instance.example.com`). Have your agent open that base URL’s install page (e.g. `{CLAWKPIT_BASE_URL}/openclaw.md` if served) and follow the steps. The page lists skill file URLs and install commands (e.g. download into OpenClaw skills dir).

**Manual**: Copy this folder into your OpenClaw skills directory (`./skills` or `~/.openclaw/skills`).

## Connect (no secrets in chat)

1. In OpenClaw, run `/clawkpit connect` and provide your Clawkpit account email when asked.
2. The agent will show a **display code** (e.g. `XXXX-XXXX`) and a URL.
3. Open that URL in your browser, sign in if needed, paste the code, and confirm.
4. The agent receives a token and stores it locally (never shown in chat).
5. Run `/clawkpit status` to confirm you’re connected.

Token can also be set via `CLAWKPIT_API_TOKEN` or OpenClaw config `skills.entries.clawkpit.env.CLAWKPIT_API_TOKEN` if you already have an API key.

## Manual test checklist

- [ ] Install skill from openclaw.md (or copy this folder into skills dir).
- [ ] Run `/clawkpit connect`; complete code in Clawkpit UI.
- [ ] Run `/clawkpit status` — shows connected.
- [ ] List: `/clawkpit inbox` or `/clawkpit today`.
- [ ] Add item: `/clawkpit add "Test task"`.
- [ ] Add note to item (via API or UI).
- [ ] Mark done: `/clawkpit done <id>` (for ToThinkAbout, ensure item has a note first).
- [ ] Drop: `/clawkpit drop <id>` (item must have at least one note).
- [ ] Focus: `/clawkpit focus`.
- [ ] Sync: `/clawkpit sync`.
- [ ] (Optional) Add heartbeat snippet as suggested in SKILL.md.

## Files

- **SKILL.md** — Main instructions for the agent.
- **api.md** — API reference (endpoints, device flow, auth).
- **README.md** — This file.
