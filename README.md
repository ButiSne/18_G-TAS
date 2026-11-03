# 18 G-TAS Design Vote

Choosing the ten tees 18 G-TAS takes to market, in three stages:

1. **Team picks** (private): each team member ranks their favourites; Borda points give a shortlist.
2. **Public vote**: Facebook and WhatsApp followers vote on the shortlist, one vote per device, tracked by `?ref=` channel.
3. **Final ten** (internal): 5 sublimation + 5 across the other print methods.

The full brief is in [`CLAUDE.md`](CLAUDE.md). Section 0 lists the decisions that override it.

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, ADMIN_EMAILS, MEMBER_EMAILS
pnpm db:migrate
pnpm db:seed
pnpm dev                     # http://localhost:3000
```

```bash
pnpm test        # unit tests: picks, Borda + tie-breaks, final-ten split, vote tally
pnpm test:e2e    # Playwright on a phone viewport
```

## Deploying (Vercel + Neon)

- Vercel runs `pnpm vercel-build`, which applies migrations on **production** deploys and then
  builds. Previews skip migrations so an unmerged branch can't change the production schema;
  set `MIGRATE_ON_BUILD=1` for Preview once Neon gives each preview its own branch.
- `DATABASE_URL` comes from the Neon integration. Neon's `channel_binding=require` is stripped
  automatically (the `postgres` driver doesn't support it); SSL stays on.
- Seed the people once, from a machine that can reach Neon (your Codespace works):

  ```bash
  ADMIN_EMAILS="Your Name <you@example.com>" MEMBER_EMAILS="A <a@example.com>,B <b@example.com>" pnpm db:seed
  ```

## The design archive

The zips (~600 MB) **never go into git**. Unzip them into `./archive/` (git-ignored) and run
`pnpm ingest` locally; display images go to Vercel Blob and only print-master paths are recorded.

## Status

See the build order checklist in `CLAUDE.md` §12.
