# STORVA merged package (2026-11-25)

Base = `project-source.zip` (newest: auth-errors/auth-guard, migrations 0000–0012 incl. private-helper security fix, Growth plan, current `supabase/config.toml` + generated `types.ts`).
Added from `STORVA-auth-security-fixed.zip`: `legacy/` (Express/Mongo app, archive), `docs/`, `database/` (legacy schema + migrations), `e2e/`, `scripts/` (Mongo→Supabase migration), `assets-originals/`, `SETUP.md`, `.npmrc`, `test:e2e` script, `.env.*` ignore rule.

Deliberately NOT used from the auth-security zip (old/conflicting), archived instead:
- `drizzle/migrations/0000–0003` -> `database/superseded-auth-zip-migrations/` (used plan id `starter`; app + live DB use `growth`; numbering collides with 0000–0012)
- its `plans.ts`/tests (`starter`), older login/reset-password (raw error.message), `package-lock.json`, stale status docs -> `legacy/auth-security-zip-docs/`

Open items (need your decision/environment):
1. Run `bun install && bun run build && bun run test` — not possible offline here.
2. Plans seed: added `drizzle/migrations/0013_seed_plans_and_single_signup_trigger.sql` (Free/Growth/Pro, DO NOTHING on conflict, drops the duplicate sign-up trigger, creates the private product-images bucket). Written and reviewed only; NOT executed against any database. Fresh-database order: `database/schema.legacy.sql` -> `drizzle/migrations` 0000-0013. Note AGENTS.md says Lovable manages `drizzle/`; confirm Lovable accepts this file.
3. `supabase/config.toml` points to project `bapvgqojvmvdjflwtqxo` (project-source). The other zip used `tucfelnmskawknuquqpd`. Keep the one you actually deploy.
4. `scripts/migrate-mongo-to-supabase.mjs` needs `npm i --no-save mongodb` (dependency removed from package.json).
