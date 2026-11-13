# AGENTS.md

SMG Fleet Management — React 18 + Vite SPA (ESM, `"type": "module"`) backed by Supabase. Project root is a Vite SPA folder, not a git repository.

## Commands

- `npm run dev` — Vite dev server on port 5173 (`host: true`, LAN-accessible)
- `npm run build` — production build to `dist/`; `npm run preview` to serve it
- `npm run lint` is BROKEN: eslint is not installed as a dependency and there is no ESLint config. Do not run or rely on it.
- There is no test framework and no typecheck step.

## Architecture

- All backend access goes through `src/services/api.js` (client in `src/services/supabase.js`, env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env`). Never bypass it with raw Supabase calls elsewhere.
- Database schema and migrations are plain SQL files in `supabase/` (`schema.sql` + standalone migration files). There is NO migration runner — apply them manually in the Supabase SQL editor.
- Auth is a custom mock, not Supabase Auth: the `users` table stores passwords in a `password_hash` column compared in plaintext (`usersApi.login` uses `.eq('password_hash', password)`), and RLS is disabled on every table. Session state is persisted to localStorage keys `user`, `session`, `lastActivity` with an inactivity timeout (`src/hooks/useInactivityTimeout.js`). Default login: `admin`/`admin` (README's demo creds are stale).
- `vehicles.code` is the unique business key; vehicle routes are `/vehicles/:code`, not by id.
- i18n: every user-facing string goes through `t()` and must be added to BOTH `src/i18n/locales/en.json` and `fr.json`. Default language comes from localStorage `smg-lang`.

## Conventions (non-obvious)

- Export columns are defined in TWO places that must stay in sync: `src/constants/exportColumns.js` and the `VEHICLE_COLUMN_KEYS` array inside `src/pages/export/Export.jsx`.
- Styling follows an Apple HIG design system: custom Tailwind theme in `tailwind.config.js` (`brand` palette, `rounded-apple*`, `shadow-apple*`) plus `--color-*` CSS vars in `src/index.css` for light/dark. Pages compute theme colors inline via `useTheme()` (e.g. `headingColor`, `isDark`). Reuse components in `src/components/ui/` instead of building new ones.
- Design/decision guidance lives in repo skills: `.claude/skills/designer`, `.agents/skills/color-mode-and-theme`, `.claude/skills/grill-me`.
- A shadcn/ui skill is installed at `.agents/skills/shadcn`. The project IS shadcn-initialized (`components.json`, `@` alias in `vite.config.js` + `jsconfig.json`, `src/lib/utils.js`, shadcn token CSS vars in `src/index.css`, shadcn token color mappings in `tailwind.config.js`) — but it's **Tailwind v3**, not v4, so procedural styling uses the Apple HIG tokens below.
- **Windows case-collision hazard:** `npx shadcn@latest add ...` writes lowercase `.jsx` files whose target dir is `src/components/ui-shadcn/` (set in `components.json` `aliases.ui`). NEVER point shadcn at `src/components/ui/` — the app's custom PascalCase components live there, and a case-insensitive filesystem will silently overwrite them (e.g. `button.jsx` already crushed `Button.jsx` once and had to be hand-recovered). Reuse custom Apple HIG components (`src/components/ui/Button.jsx`, `Input.jsx`, `Select.jsx`, etc.) for app UI; treat `ui-shadcn/` components as opt-in primitives.
- `dist/` is committed build output; `export-model.xlsx` and `export-template.xlsx` are generated download artifacts (safe to regenerate/ignore).