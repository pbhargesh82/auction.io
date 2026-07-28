# AGENTS.md

## Cursor Cloud specific instructions

This is **Auction.io**, an Angular 20+ single-page app (fantasy-sports auction manager). It is **frontend-only** and talks directly to a **hosted Supabase** backend (PostgreSQL + Auth + Storage + Realtime). There is no custom backend server in this repo.

### Services

| Service | Required | How to run | Notes |
| --- | --- | --- | --- |
| Angular dev server | Yes | `npm start` (→ `ng serve`, port 4200) | The app itself. Use `npm start -- --host 0.0.0.0 --port 4200` if you need external access. |
| Supabase backend | Yes | none — hosted | URL + anon key are hardcoded in `src/environments/environment.ts` (dev) and `environment.prod.ts` (prod). No `.env` file. Requires network egress to `*.supabase.co`. |

There is a `supabase/config.toml` for optional local Supabase, but it has **no migrations/seed**, so a local stack would be an empty schema. The hosted instance is the intended target — do not spin up local Supabase unless you also apply the `database/*.sql` files.

### Commands (authoritative source: `package.json` scripts)

- Install: `npm install`
- Dev server: `npm start`
- Production build: `npm run build`
- Tests: `npm test` (`ng test`, Karma + Jasmine, needs a Chrome binary; `google-chrome` is available on the VM)
- Lint: **none configured** — there is no `lint` script and no ESLint config in this repo.

### Non-obvious gotchas

- **Test suite is broken as committed.** The two spec files are stale Angular scaffold tests:
  - `src/app/components/teams/teams.component.spec.ts` imports `Teams` from `./teams` (a non-existent module), so the whole `ng test` build fails to compile.
  - `src/app/app.spec.ts` "should render title" asserts default scaffold text (`Hello, auction.io`) that the real `app.html` does not contain, so it fails at runtime.
  These are pre-existing repo bugs, not environment issues. The Karma harness itself works with Chrome Headless.
- **Headless Karma:** the repo has no `karma.conf.js`. To run tests headlessly in the container, pass a temporary karma config that adds `frameworks: ['jasmine']` and a `ChromeHeadlessNoSandbox` launcher with flags `--no-sandbox --disable-gpu --disable-dev-shm-usage --headless=new`, and set `process.env.CHROME_BIN = '/usr/local/bin/google-chrome'`. The config must live inside the repo (not `/tmp`) so plugin module resolution works.
- **Auth requires email confirmation.** The hosted Supabase project has email confirmation enabled, so a freshly signed-up account cannot log in until its email is confirmed. Signup itself works (creates the user and sends a confirmation), but reaching the authenticated dashboard / auction-management flows needs an already-confirmed account. Supabase also rejects `@example.com` addresses as invalid.
- **Angular CLI is a devDependency**, so use `npm run ...` scripts or `npx ng ...` (no global `ng`).
- The committed `package-lock.json` was stale (version `0.0.0`, missing `@supabase/supabase-js`); `npm install` regenerates it in sync with `package.json`.
