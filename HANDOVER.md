# HANDOVER — 18 G-TAS Design Vote

> For **Claude Code running in VS Code** on the owner's machine. This file is the starting point:
> it says where the build stands, how to run it, how it deploys, and what to build next, in order.
> Read it top to bottom before the first change. Then read `CLAUDE.md`. **Section 0 of
> `CLAUDE.md` overrides the rest of that brief.**

Handover date: 3 November 2026. Last commit at handover: see `git log -1`.

---

## 1. What this system is, in one paragraph

18 G-TAS (a KZN clothing brand) picks the **ten t-shirt designs** it will test in the market, in
three stages:

1. **Team picks (private).** Internal team members each rank their favourite designs. Borda points
   make a shortlist.
2. **Public vote.** The shortlist goes to prospective customers through the brand's **Facebook**
   page and **WhatsApp** groups. Each shared link carries `?ref=` (`fb`, `wa-<group>`), so results
   can be read per channel. No account is needed, and each device gets one vote.
3. **Final ten (internal).** The team picks the ten, using team points and public results side by
   side: **exactly 5 sublimation**, plus **5 shared across the other print methods**.

---

## 2. State at handover

### Done (PR [ButiSne/18_G-TAS#1](https://github.com/ButiSne/18_G-TAS/pull/1), branch `claude/busy-dijkstra-w6py1c`)

| Area     | What exists                                                                                                   | Where                                          |
| -------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Scaffold | Next.js 16 (App Router), TypeScript, Tailwind v4, brand tokens, 5 Google fonts, light/dark mode, mobile first | `app/`, `app/globals.css`                      |
| Schema   | 15 tables, first migration                                                                                    | `src/db/schema.ts`, `drizzle/0000_init.sql`    |
| Rules    | Pick validation, Borda + tie-breaks, shortlist cut, final-ten 5 + 5 check, vote tally per `ref`               | `src/lib/*.ts`                                 |
| Tests    | 34 unit tests (Vitest), 1 end-to-end test on a phone viewport (Playwright)                                    | `test/`, `e2e/`                                |
| Seed     | Admins and team from env config, one draft round; safe to re-run                                              | `scripts/seed.ts`                              |
| Legal    | Privacy and rules placeholder pages marked **TO BE REVIEWED**                                                 | `app/(legal)/`                                 |
| CI       | GitHub Actions: lint, typecheck, format, unit tests, build                                                    | `.github/workflows/ci.yml`                     |
| Deploy   | `vercel.json` pins Next.js; `vercel-build` migrates on **production** only                                    | `vercel.json`, `scripts/migrate-on-deploy.mjs` |
| Strings  | All UI text in `messages/en.json` (isiZulu can follow as `zu.json`)                                           | `messages/`                                    |

Verified: CI green and the Vercel preview **Ready**. The migration, the seed (run twice) and the
`channel_binding` fix were all checked against a local Postgres 16.

### Not done yet

- **PR #1 is not merged.** It is still a draft. Until it merges, production (`18g-tas.vercel.app`)
  serves the initial README commit, and **the production Neon database has no tables**.
- **The production database has never been migrated or seeded.** The cloud session that built
  this could not reach Neon.
- **No design data.** The archive was never available to the cloud session.
- **Nothing from build-order step 3 onwards exists.** No ingest, catalogue, auth, picks UI,
  admin, voting, OG images, cron or polish.

### Decisions still owed by the owner (ask; don't guess)

1. **Print-method list.** `src/lib/print-methods.ts` currently has sublimation, DTF, screen print,
   vinyl, embroidery and puff. The owner should confirm or edit it. Only "sublimation vs not"
   affects the rules, so changing the others is safe.
2. **Does the "other 5" need a minimum per method** (e.g. at least 1 DTF)? The current answer is
   no: any split is allowed.
3. **Admin and team names and emails**, for the seed.
4. **Custom domain** (the brief suggests `vote.18gtas.co.za`).
5. **Email sender** for magic links. Resend has a free tier; the brief says to ask before adding
   any paid service.

---

## 3. Security first: things to do before anything else

- **Rotate the Neon database password.** The production connection string, password included, was
  pasted into a chat during the cloud session. In Neon: _project `neon-aqua-globe` → Roles →
  `neondb_owner` → Reset password_. Then confirm Vercel's `DATABASE_URL` updated (the Neon
  integration normally does this) and redeploy.
- **Never commit secrets.** `.env`, `.env.local` and `.env*.local` are git-ignored; keep it that
  way. Commit `.env.example` with **empty values only**.
- **Never commit the design archive.** `archive/` is git-ignored. Git history keeps large files
  forever, and the zips are ~600 MB.

---

## 4. Machine setup (Windows + VS Code)

1. **Node 22.9 or later** (needed for `--env-file-if-exists` and `--experimental-strip-types`).
   Check with `node -v`. Node 24 LTS is fine.
2. **pnpm** through Corepack, in PowerShell:
   ```powershell
   corepack enable
   corepack prepare pnpm@10.28.0 --activate
   ```
3. **Clone and install:**
   ```powershell
   git clone https://github.com/ButiSne/18_G-TAS.git
   cd 18_G-TAS
   git checkout claude/busy-dijkstra-w6py1c   # or main, once PR #1 is merged
   pnpm install
   ```
4. **`.env.local`:** copy `.env.example` to `.env.local` and fill it in. Use single quotes around
   any value containing `&` (Neon URLs do):
   ```
   DATABASE_URL='postgresql://neondb_owner:<NEW_PASSWORD>@<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
   ADMIN_EMAILS="Owner Name <owner@example.com>"
   MEMBER_EMAILS="Name One <one@example.com>,Name Two <two@example.com>"
   HASH_SALT=<a long random string>
   ```
   `pnpm db:migrate`, `pnpm db:seed` and `pnpm ingest` all read `.env.local` themselves, so no
   shell-specific `VAR=value` syntax is needed. Confirmed on Windows PowerShell (Node 22.19,
   pnpm 10.28) against the Docker database, 3 Nov 2026.
5. **A database for development:** don't develop against production. The default is the Docker
   Postgres in `docker-compose.yml` (needs Docker Desktop running):
   ```powershell
   pnpm db:up        # starts 18gtas-db on localhost:5418 (gtas_dev + gtas_test)
   pnpm db:migrate
   pnpm db:seed
   pnpm db:psql      # a psql shell inside the container
   pnpm db:reset     # wipe the volume and rebuild: up, migrate, seed
   ```
   with `DATABASE_URL=postgres://gtas:gtas@localhost:5418/gtas_dev` in `.env.local`. Schema changes
   reach Neon only through the production deploy (`scripts/migrate-on-deploy.mjs`); never run
   `drizzle-kit push` against Neon. A Neon **branch** named `dev` also works if Docker isn't
   available.
6. **Playwright browsers:** `pnpm exec playwright install chromium` once. (`PW_CHROMIUM_PATH` in
   `playwright.config.ts` only exists for machines with a pre-installed Chromium.)
7. **Recommended VS Code extensions:** ESLint, Prettier, Tailwind CSS IntelliSense, Playwright Test.

### Daily commands

```powershell
pnpm dev            # http://localhost:3000
pnpm test           # unit tests
pnpm test:e2e       # Playwright (builds and starts the app itself)
pnpm lint; pnpm typecheck; pnpm format:check
pnpm db:generate    # after editing src/db/schema.ts: writes a new migration into drizzle/
pnpm db:migrate     # applies migrations to DATABASE_URL
pnpm db:seed        # admins, team, one draft round
```

---

## 5. Deployment and hosting, as configured

| Thing          | Value                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| GitHub repo    | `ButiSne/18_G-TAS` (default branch `main`)                                                            |
| Vercel project | `18_g-tas`, team `snehlongwane-4513s-projects`                                                        |
| Production URL | https://18g-tas.vercel.app                                                                            |
| Previews       | One per PR branch, e.g. `18g-tas-git-<branch>-snehlongwane-4513s-projects.vercel.app`                 |
| Database       | Neon project `neon-aqua-globe` (ID `solitary-shadow-33879428`), linked through the Vercel Marketplace |
| Build          | `vercel.json` → `framework: nextjs`, `buildCommand: pnpm vercel-build`                                |

### How a deploy behaves

- **Production** (a push to `main`): `scripts/migrate-on-deploy.mjs` runs `drizzle-kit migrate`
  against `DATABASE_URL`, then `next build`. A missing `DATABASE_URL` **fails the deploy** on
  purpose.
- **Preview** (any PR): migrations are **skipped**, so an unmerged branch can never change the
  production schema. Once Neon's Vercel integration is set to create a **database branch per
  preview**, set `MIGRATE_ON_BUILD=1` for the Preview environment so previews migrate their own
  branch.
- **Never run `db:generate` on two branches in parallel.** Drizzle migration numbers would
  collide. Generate on the branch you are about to merge, and merge `main` in first.

### Known gotchas (each one has already cost time)

1. **`channel_binding=require`** in Neon URLs breaks the `postgres` driver ("unrecognized
   configuration parameter"). `src/db/url.ts` strips it, and both the app and `drizzle.config.ts`
   use that. Any new DB entry point must use `createDb()` or `normaliseDatabaseUrl()`.
2. **The Vercel framework preset** was not detected, because the project was imported while the
   repo held only a README. `vercel.json` pins it now. Don't delete it.
3. **Imports in anything run by plain Node** (`scripts/*.ts` and what they import) need explicit
   `.ts` extensions, because `--experimental-strip-types` doesn't resolve extensionless paths. Code
   only Next.js runs can use either.
4. **pnpm build scripts are allow-listed** in `package.json → pnpm.onlyBuiltDependencies`
   (currently `esbuild`). When adding **`sharp`** for ingest, add it there too, or its native
   binary won't install.
5. **Next 16 renamed `middleware.ts` to `proxy.ts`.** Check the Next 16 docs in
   `node_modules/next/dist/docs` or online before writing route protection, and don't rely on
   memory of older versions.
6. **Tailwind v4** has no `tailwind.config.ts`. Tokens live in `app/globals.css` under `@theme`
   (e.g. `bg-onyx`, `text-gold`, `font-luxe`).
7. **Gold on ivory fails WCAG AA** (~2.2:1). In light mode the accent is `--color-gold-dark`.
   Always use `var(--accent)` for accent text, never raw gold.

### Vercel environment variables (Project → Settings → Environment Variables)

| Variable                                             | Production                                          | Preview                              | Source                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | ✓                                                   | ✓ (per-preview Neon branch, ideally) | Neon integration                                                                       |
| `HASH_SALT`                                          | ✓                                                   | ✓ (a different value)                | You: long random string. **Never change it mid-round**, or every device can vote again |
| `AUTH_SECRET`                                        | ✓                                                   | ✓                                    | `npx auth secret` (step 5)                                                             |
| `AUTH_EMAIL_FROM`, `RESEND_API_KEY`                  | ✓                                                   | ✓                                    | Resend (step 5; ask the owner first)                                                   |
| `BLOB_READ_WRITE_TOKEN`                              | ✓                                                   | ✓                                    | Vercel Blob store (step 3)                                                             |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | ✓                                                   | ✓                                    | Upstash through the Marketplace (step 9)                                               |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`         | ✓                                                   | ✓ (test keys)                        | Cloudflare Turnstile (step 9)                                                          |
| `ADMIN_EMAILS`, `MEMBER_EMAILS`                      | seed only                                           | —                                    | Owner                                                                                  |
| `NEXT_PUBLIC_SITE_URL`                               | `https://18g-tas.vercel.app` (or the custom domain) | preview URL                          | You                                                                                    |

---

## 6. Go-live sequence for what exists now

Do these in order and stop at the first failure.

1. Rotate the Neon password (section 3).
2. On GitHub, mark PR #1 **Ready for review**, check that CI is green, and **merge** it.
3. Watch the production deploy in Vercel. The build log must show `[✓] migrations applied
successfully!`. If it doesn't, read the log; the usual causes are a missing `DATABASE_URL` in
   the Production environment or the old password.
4. Seed production once, from VS Code, with `.env.local` temporarily pointing at the **production**
   Neon URL and real names and emails:
   ```powershell
   pnpm db:seed
   ```
   Expect `Seeded N admin(s), M member(s).` Then point `.env.local` back at the `dev` branch.
5. Open https://18g-tas.vercel.app on a phone and check the landing page plus `/privacy` and
   `/rules`, in light and dark mode.
6. In GitHub → Settings → Branches, protect `main`: require the `check` status and a PR.

---

## 7. Build plan from here

One PR per step, each branched from fresh `main`. Keep every PR green. Tick the step in
`CLAUDE.md §12` in the same PR. Commit messages say _why_. Tests come **first** for any rule.

### Step 3: ingest (`scripts/ingest.ts`, run locally)

> **Now replaced by the Blob-ready design pack (4 Nov 2026).** The pack in
> `archive/ALL DESIGN IMAGES/18GTAS_Blob_Ready/18GTAS_Blob_Ready/` has a `manifest.json` that
> states range, collection, print method, placement, tee colour and status for every image, so
> no filename guessing is needed. `pnpm ingest:pack` loads it (`scripts/ingest-pack.ts`):
>
> ```powershell
> pnpm ingest:pack --dry-run   # report only: ingest-pack-report.md
> pnpm ingest:pack             # Blob at the manifest's own pathnames (18gtas/designs/…), then DB
> ```
>
> - One design per `family` and one colourway per front record. A back view attaches to its front
>   (Front/Back toggle on the design page, flip button on the card).
> - Superseded families are kept but hidden.
> - It retires the designs from the old archive ingest (family keys containing `/`): deleted
>   when nothing references them, hidden when a past round does.
> - A second run uploads and changes nothing. Admin edits to title, line and print method
>   survive a re-run.
> - Print methods are now the pack's eight (`src/lib/print-methods.ts`). Full and cotton
>   sublimation fill the sublimation five.

> **Built (3 Nov 2026, branch `feat/ingest`).** How to run it:
>
> ```powershell
> pnpm ingest --dry-run      # report only: ingest-report.md
> pnpm ingest --store=local  # Docker dev: images to public/_local/ (git-ignored), no cloud
> pnpm ingest                # Vercel Blob when BLOB_READ_WRITE_TOKEN is set
> pnpm test:int              # ingest twice against gtas_test: second run changes nothing
> ```
>
> What the real archive taught us:
>
> - The Tee-72 file names have no EITEEN/ELDERS labels. The lines come from the two collection
>   sheets, recorded in `data/line-overrides.json`.
> - Round 10 colourways are colour names, not `_A`/`_B`.
> - Print masters are spelled differently from the mockups (`FourSquares` vs `Four_Squares`).
> - Tee colour is sampled from the mockup sleeves. sharp's `stats()` ignores `extract()`, so raw
>   pixels are averaged instead.
> - Families with no decidable line are reported and **not imported** until the owner adds them
>   to the overrides file.
> - Re-runs never overwrite an admin's edits to title, line or slug.

The archive lives on the owner's machine (originally `C:\pe\18G-TAS`, also in the owner's
Codespace). Unzip every zip into `./archive/` inside the repo; it is git-ignored.

- **Dependencies:** `sharp`, `@vercel/blob`. Add `sharp` to `pnpm.onlyBuiltDependencies`.
- **Split the work into pure functions plus a thin runner,** so the logic is unit-testable without
  files:
  - `src/ingest/classify.ts`: path → `display | print_master | ignore | unknown`. Use the rules in
    CLAUDE.md §4.2. Unknown files are **reported, never guessed**.
  - `src/ingest/family.ts`: filename → `{ familyKey, colourway, title }`. Strip `_A`/`_B`… suffixes;
    underscores become spaces (§14).
  - `src/ingest/line.ts`: assign `EITEEN` / `G-TAS` from `EITEEN` / `ELDERS` labels first, then
    from keywords. Anything it can't decide goes in the report.
  - `src/ingest/brand-check.ts`: flag the banned names in §6. Use **word-boundary** matching, so
    "LV" doesn't flag "SILVER" and "Puma" doesn't flag "Pumalanga". Test both cases.
- **Windows paths:** walk with `node:fs/promises` `readdir({ recursive: true })`, and record paths
  **relative to `archive/` with `/` separators**, so a path recorded on Windows still matches on
  another machine.
- **Images:** WebP at 1600 px, plus a 480 px thumbnail. Hash the **source bytes** with SHA-256
  (`colourway.image_hash` is unique), so a re-run skips anything already uploaded. Upload to Blob
  with a deterministic pathname (`designs/<slug>/<colourway>-1600.webp`) and
  `addRandomSuffix: false`.
- **Idempotent upserts:** upsert collection by `slug`, design by `slug`, and colourway by
  `image_hash`. Running ingest twice must change nothing; add a test for this that runs against a
  temporary schema, or keep the DB writes so thin that the pure functions carry the logic.
- **`ingest-report.md`** (git-ignored) should list unmatched files, unknown lines, brand-name
  flags, duplicates removed, and families with no display image.
- **`print_method` is not in the filenames**, so ingest leaves it `NULL`. The admin sets it in
  step 8. A design with `NULL` cannot enter the final ten (already enforced in `final-ten.ts`).
- **Dry run first:** add `pnpm ingest --dry-run`, which writes only the report. Show the owner the
  report before the first real upload.

### Step 4: catalogue

`/designs` and `/designs/[slug]`: server components that query Drizzle directly.

- One card per family, with colourway dots to switch.
- Filters (line, collection, tee colour, print method) as URL search params, so a filtered view can
  be shared. Add search, and a shuffle with a seed in the URL so it is stable while scrolling.
- `next/image` with Blob URLs (the domain is already allowed in `next.config.ts`).
- Alt text comes from `title + colourway`.
- During the team round, `/designs` is **members only**.

### Step 5: member and admin auth

- Auth.js with an email provider (Resend is the default suggestion; ask the owner first).
- **Invite-only:** refuse sign-in for any email not in `member`.
- Protect `/members/*` and `/admin/*` in `proxy.ts` (Next 16; see gotcha 5) **and** again inside
  every server action. The proxy is a convenience; the action check is the real guard.
- Admin means `member.role = 'admin'`.

### Step 6: picks

- `/members/picks`: a sticky tray at the bottom with N slots (N = `selection_round.picks_per_member`).
  Drag to reorder, with a keyboard alternative (move up/down buttons). Tap to remove. Show
  "4 of N".
- The server action validates with `validatePicks()` (`src/lib/picks.ts`) and writes inside one
  transaction: delete this member's picks for the round, then insert. Submit sets
  `round_member.submitted_at` and locks; edits after that are refused unless the admin unlocks.
- Only members in `round_member` for that round may pick.
- **Auto-close:** when every `round_member` has `submitted_at`, set the round to `closed`, in the
  same transaction as the last submit.

### Step 7: scoring and results

- `computeStandings()` and `cutShortlist()` already exist and are tested; this step is wiring them
  up.
- `/members/results` shows the points table and consensus badges. **Who picked what** stays hidden
  until the round is `closed`. Enforce that in the query, not only in the UI.
- When `cutShortlist()` returns `needsDecision`, the admin chooses, and the choice goes into
  `shortlist.tie_break_note` **and** `audit_log` (tie-break 3).

### Step 8: admin

- `/admin`:
  - Rounds: create, open, close, set picks per member (1–20) and shortlist size (10–40).
  - Choose the team for each round (`round_member`), and unlock a member.
  - Shortlist screen: show `shortlistCoverage()` warnings when the shortlist has fewer than 5
    sublimation or 5 other designs.
  - **Confirm shortlist** creates `public_round` and its `public_entry` rows.
- `/admin/designs`: edit title, line, tags, **print method** (validated with `isPrintMethod`), and
  hidden; merge families.
- **Final ten screen (stage 3):** team points and public results side by side, two columns
  (Sublimation 5, Other 5). Save through `validateFinalTen()`. Write `final_selection` rows, with
  the print method copied in.
- CSV exports, **aggregates only**: picks, shortlist with points, and votes by design × age bracket
  × province × `ref`.
- **Production hand-off:** list the print-master paths for the final ten.
- **Every admin action writes `audit_log`.** Put it in one helper, so it cannot be forgotten.

### Step 9: public vote (favourite mode)

- `/vote?ref=…`: full-screen swipeable cards, tap to zoom, one big **Vote** button.
- **Order on the server:**
  1. Verify Turnstile.
  2. Apply the rate limit (Upstash, per IP hash and per device hash).
  3. Read or set the signed httpOnly device cookie.
  4. Compute `device_hash` and `ip_hash` as SHA-256 with `HASH_SALT`.
  5. Insert the vote.
- The unique constraint `vote_one_per_device` is the final guard. Catch its violation and answer
  politely ("You've already voted in this round").
- **The raw IP is never stored or logged.**
- `ref` goes through `normaliseRef()`.
- Demographics are optional; nothing is required to vote.
- After a vote, go to `/vote/thanks` with share buttons. The WhatsApp share uses
  `https://wa.me/?text=` plus the link with `?ref=`. Confetti respects `prefers-reduced-motion`.
- **POPIA:** no names, emails or phone numbers from anyone under 18. The email-code option is only
  shown after an 18+ confirmation, and only when the admin enables `require_email`.
- Results stay hidden until published unless `show_live_results` is on.

### Step 10: head-to-head mode

- Add `src/lib/elo.ts` (or Bradley-Terry), with tests first:
  - Symmetry.
  - Total-rating conservation for Elo.
  - Convergence on a known ordering.
  - Order independence for Bradley-Terry, if chosen.
- Pairing should favour entries with few comparisons.

### Step 11: sharing

- `/api/og/[slug]` with `next/og`: mockup, design name, "Vote now". 1200×630 works for WhatsApp,
  Facebook and X.
- Per-channel links for the admin to copy: `fb`, `wa-<group>`.

### Step 12: legal and retention

- A Vercel Cron job (`vercel.json → crons`) runs daily. For rounds published more than 90 days ago:
  1. Roll `vote` and `matchup` rows up into `vote_aggregate`.
  2. Delete the raw rows.

  Do both in one transaction, and test it.

- Legal text stays **TO BE REVIEWED** until a person signs it off.

### Step 13: polish

- Pass an axe audit (add `@axe-core/playwright` to the e2e tests).
- Lighthouse ≥ 90 on mobile.
- Empty and error states.
- isiZulu strings, if the owner wants them.

### Step 14: launch

- **Production environment variables:** every variable in the section 5 table is set.
- **Domain:** the custom domain is live.
- **Dry run:** a full run with the real team on a preview: team round, shortlist, public vote
  from a phone through a WhatsApp link, final ten.
- **Handover:** admin credentials are handed over through a password manager.

---

## 8. Rules that must not break (they have tests; if one fails, the code is wrong)

- Borda: with N picks, rank 1 = N points … rank N = 1.
- Tie-breaks: points, then picked by more members, then more first places. Anything still tied at
  the cut goes to the **admin**, and the decision is logged. The code never chooses silently.
- Final ten: exactly 10, of which **5 sublimation + 5 non-sublimation**. A design without a print
  method is refused.
- One vote per device per public round (DB unique constraint + cookie + hash).
- Only salted hashes of IPs and devices are stored. Exports never include hashes.
- `?ref=` accepts short slugs only (`^[a-z0-9][a-z0-9-]{0,39}$`); anything else becomes `null`.
- No club, federation or kit-maker names in design titles (the ingest report flags them).

---

## 9. First prompt to paste into Claude Code in VS Code

```text
Read HANDOVER.md, then CLAUDE.md (section 0 overrides the rest). Confirm the go-live sequence in
HANDOVER.md section 6 is done; if PR #1 is not merged yet, stop and tell me. Then:
1. Run pnpm install, pnpm test, pnpm lint, pnpm typecheck and report the results.
2. Check that pnpm db:migrate and pnpm db:seed work in PowerShell against my Neon dev branch
   (.env.local).
3. Start step 3 (ingest) on a new branch from main, in plan mode: show me the plan and the
   pure functions you will test before writing the runner. My archive is unzipped at ./archive.
Ask me before adding any paid service, and never commit .env.local or archive/.
```
