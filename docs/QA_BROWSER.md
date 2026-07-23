# Browser QA (Cursor agent)

Auction.io uses **agent-driven browser QA** (same idea as the Bridginex tbrg site), not Playwright/Cypress yet. After UI changes, the agent must verify in Cursor’s browser against `http://localhost:4200` before calling the task done.

## Rules

| Rule | Path |
|------|------|
| Coding loop (Plan → implement → QA → fix) | [`.cursor/rules/ai-coding-loop.mdc`](../.cursor/rules/ai-coding-loop.mdc) |
| Browser verification checklist | [`.cursor/rules/ui-browser-qa.mdc`](../.cursor/rules/ui-browser-qa.mdc) |

## How to run

1. Start the app: `npm start` (serves on port **4200**).
2. In Cursor, after a UI change, the agent opens the browser MCP, navigates to the affected route/flow, and iterates until correct.
3. Prefer an already logged-in browser session.

## QA account

- Use a **dedicated QA user** (email/password) for agent login when no session exists.
- Provide credentials out-of-band (chat / password manager). **Never** commit them to the repo, rules, or this doc.
- Do not rely on Google OAuth for agent QA.
- Agent-local copy (gitignored — never commit): [`qa-credentials.local`](../qa-credentials.local) at the repo root.

## QA Sandbox auction

Destructive checks (sell, unsold, reset, delete auction, ban user, creating throwaway data) must only run against a **QA Sandbox** auction you designate (name or ID shared with the agent).

If no sandbox is designated:

- Agent runs **read-only / smoke** checks only.
- Destructive steps are skipped and called out in the QA summary.

## Named critical flows

Stable names for agent QA (and a future Playwright suite if added later):

| Flow | Intent |
|------|--------|
| `auth.login` | Email/password → `/home` |
| `auth.guard` | Logged-out `/home` → `/login` |
| `home.list` | Auctions list; open workspace |
| `workspace.nav` | Navigate all workspace tabs |
| `public.view` | `/view/:slug` without auth |
| `control.smoke` | Live desk UI (mutations = sandbox only) |
| `admin.gate` | `/user-management` by role |

## Playwright (deferred)

Automated E2E (Playwright) and Jest unit-test migration are **out of scope** for now. When added later, mirror the named flows above.
