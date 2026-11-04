# CLAUDE.md — 18 G-TAS Design Vote

> **Start with [`HANDOVER.md`](HANDOVER.md)**: current state, setup, deploy, and the build plan from step 3.

> Build brief for Claude Code. Put this file in the root of the GitHub repo as `CLAUDE.md`.
> Goal: take the 18 G-TAS design archive online so that **(1)** the five members of 18 G-TAS each pick their **six favourite designs**, and **(2)** the combined shortlist goes to a **public vote among the youth**.
> Hosting: **GitHub → Vercel** (preview deployment per pull request, production on `main`).

---

## 0. Decisions that override this brief (agreed with the owner, Nov 2026)

Where this section and the rest of the brief disagree, **this section wins**.

1. **Three stages, not two.**
   1. **Team round (private):** internal team members pick and rank favourites → a team shortlist.
   2. **Public round:** prospective customers vote on the shortlist through links shared on our **Facebook** page and **WhatsApp** groups. Each link carries `?ref=` (e.g. `fb`, `wa-<group>`) so we can see which channel voted for what.
   3. **Final ten (internal):** the team picks the **10 designs to test in the market**, using team points and public results side by side. Exactly **5 sublimation** designs, and the **other 5 shared across the other print methods** (DTF, screen print, vinyl, embroidery…).
2. **Team size and picks per member are set by the admin per round** — not fixed at 5 × 6. Scoring stays Borda: with *N* picks, rank 1 = *N* points … rank *N* = 1 point. "Auto-close when everyone has submitted" means everyone invited to *that* round.
3. **Every design needs a print method** before it can enter the final ten. `print_method` is editable in `/admin/designs`; the list lives in `src/lib/print-methods.ts` and is still **to be confirmed** by the owner.
4. **Default shortlist size is 20** (allowed 10–40), so the final ten has room to find 5 + 5. The shortlist screen warns when it holds fewer than 5 sublimation or 5 non-sublimation designs.
5. **Public voters are not only youth.** The POPIA rules in section 6 still apply in full, because under-18s will be among them.
6. **Tailwind v4** keeps its tokens in `app/globals.css` under `@theme`, not in `tailwind.config.ts`. Same tokens, newer home.
7. **The public vote is a swipe deck, strictly mobile first (agreed 3 Nov 2026).** One full-screen card per shortlisted design: swipe right = **YEBO**, swipe left = **CHA** (isiZulu; the words live in `messages/en.json`), with buttons, keyboard and undo as alternatives. At the end the voter may pick a "number one" (stored as the favourite `vote`), and gets a shareable "your style" card. A new public mode `swipe` is the default; favourite mode stays as an option; head-to-head (step 10) is deferred. Use only the gesture pattern from dating apps, never their names or visuals. The aim is that voters feel their opinion shapes the next drop.
8. **Development runs on Docker Postgres** (`docker-compose.yml`, `pnpm db:up`); production is Neon through Vercel, and schema changes reach Neon only through the production deploy.
9. **Team sign-in is by WhatsApp invite link, not email (agreed 4 Nov 2026).**
   - **The link:** the admin taps "Create invite link" in `/admin` and sends it on WhatsApp. It works once, on one phone, for 24 hours, and a new link cancels the old one.
   - **Using it:** opening the link only shows a "Sign in on this phone" button. Signing in happens on the tap (POST), so WhatsApp link previews can't burn the link.
   - **Storage:** sessions are httpOnly cookies lasting 30 days. Tokens are stored only as SHA-256 hashes, and the admin can sign anyone out of every phone.
   - **First admin:** gets their link from `pnpm invite "<name>"`.
   - **No email:** no email service or domain is needed, so Resend and Auth.js are not used.
   - **`/designs` stays team-only until the public vote**, so unreleased designs never leak.

---

## 1. Brand context (read first)

**18 G-TAS** is a South African clothing brand from KwaZulu-Natal ("Mzansi").
Two lines, one brand:

| Line | Audience | Voice |
|---|---|---|
| **EITEEN G-TAS** | Teens and youth | Bold, playful, street, pixel, kasi culture |
| **G-TAS** | Elders and premium buyers | Quiet luxury, gold, XVIII Roman numerals, monograms |

Signature brand assets: the pennant triangle, the **18 mark** (a "1" beside an "8" built from two diamonds), the **linked logo** (the 1's pennant upright, the 8's pennant hanging), and the **XVIII · G-TAS** wordmark.

### Design tokens (use these, nothing else)

```css
--onyx: #0D0D0D;      --ivory: #F3EDE2;     --gold: #C9A24A;
--gold-light: #F7E9BF; --gold-dark: #8C6A1F; --midnight: #141B2D;
--mzansi-green: #007A4D; --mzansi-gold: #FFB612;
--teal: #1AA3B8; --coral: #FF6B35; --pink: #FF3EA5; --lime: #C6FF3D;
```

Fonts (Google Fonts, free for commercial use): **Playfair Display** (luxury headings), **Archivo Black** (youth headings), **Cinzel** (XVIII / numerals), **Montserrat** (UI body), **Space Mono** (labels, counters).

UI rule: elders' pages lean onyx and gold; youth pages may use the neon accents. Always support light and dark mode. Mobile first, because most voters will arrive from WhatsApp and Instagram on a phone.

---

## 2. What we are building

```
Phase 0  Ingest      design archive (zips)  →  catalogue of designs + images
Phase 1  Members     5 members × 6 picks each (private)  →  ranked shortlist
Phase 2  Public      youth vote on the shortlist (public)  →  winners for production
```

### Phase 1: Members' selection (private)
- Exactly **five members**, invited by the admin. Names and emails go in the seed config; don't hard-code them.
- Each member browses the full catalogue, filters it, and picks **exactly six favourites**, ranked 1 to 6 with drag and drop.
- A member can change their picks until they press **Submit**. After that the picks are locked; only the admin can unlock them.
- Members **cannot see each other's picks** until all five have submitted, or the admin closes the round. This avoids influence.
- **Scoring (Borda count):** rank 1 = 6 points, rank 2 = 5 points, down to rank 6 = 1 point.
- **Shortlist:** the admin sets the size (default **6**, allowed 6 to 12) and confirms it.
  - Tie-break 1: the design picked by more members wins.
  - Tie-break 2: more first-place picks wins.
  - Tie-break 3: the admin decides, and the decision is logged.
- **Results view (members and admin):** a points table, who picked what (revealed after close), and a "consensus" badge for any design picked by 3 or more members.

### Phase 2: Public youth vote
- A public, mobile-first voting page showing only the shortlisted designs, with large mockups, swipe between designs, and a tap to zoom.
- **Voting modes** (admin chooses per round):
  1. **Pick your favourite**: one vote per voter. This is the default.
  2. **Head-to-head**: two designs at a time, "which one?". Rank the designs with an Elo or Bradley-Terry score. More engaging for teens.
- **Integrity without heavy personal data:**
  - A bot check on every vote (Cloudflare Turnstile, free).
  - Rate limiting per IP and per device (Upstash Redis or Vercel KV).
  - One vote per device per round, using a signed, httpOnly cookie plus a hashed device fingerprint.
  - Optional stronger mode, admin toggle: sign in with a one-time code by email. Adults (18+) only, see POPIA in section 6.
- **Demographics, optional and anonymous:**
  - Age bracket: 13–15, 16–17, 18–24, 25–34, 35+.
  - Province, and an optional free-text "school or area". Show a clear notice that this field is optional.
- **Results:** hidden while voting is open by default, to avoid a bandwagon effect. The admin can switch on a live leaderboard. After closing, a results page shows the winners, a percentage per design, and a split by age bracket.
- **Sharing:** every design has an Open Graph share image (mockup, design name, "Vote now"), sized for WhatsApp, Instagram and X. Optional share links with a `?ref=` code, to see which schools or areas brought votes.

---

## 3. Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router) + TypeScript**, Server Actions / Route Handlers |
| Styling | Tailwind CSS with the tokens above, mapped in `tailwind.config.ts` |
| Database | **Postgres**: Neon through the Vercel Marketplace (or Supabase) |
| ORM | Drizzle ORM (or Prisma), with migrations committed to the repo |
| Auth (members, admin) | Magic-link email sign-in (Auth.js / NextAuth with an email provider, e.g. Resend), invite-only |
| Images | **Vercel Blob** for mockups and lookbooks. Never commit the 600 MB archive to git |
| Rate limit / cache | Upstash Redis (`@upstash/ratelimit`) or Vercel KV |
| Bot check | Cloudflare Turnstile |
| OG images | `next/og` (`ImageResponse`) |
| Analytics | Vercel Analytics (privacy-friendly, no cookies) |
| Tests | Vitest for unit tests (scoring, tie-breaks, Elo), Playwright for end-to-end flows |
| CI | GitHub Actions: lint, typecheck and tests on every pull request. Vercel builds preview deployments |

Keep the dependency list short. Prefer the platform features above to new services.

---

## 4. Phase 0: ingest the design archive

The designs come as zip files exported from the design rounds. Unzip them into `./archive/` locally. **Add `archive/` to `.gitignore`.**

Expected folders (the names may vary slightly between zips):

```
18GTAS_Complete_Collection/01_First_Colourways … 21_Football_and_Street
18GTAS-EITEEN-AllOver, 18GTAS-Favourites, 18GTAS-Pinstripes-360-Summer,
18GTAS-Pinstripes-Velvet-360, 18GTAS-Mzansi-Retro-96, 18GTAS-Updates-Nov,
18GTAS-logo-exploration-upright, 18GTAS-Tee-Collection-72, 18GTAS-Round-10
```

Write `scripts/ingest.ts` (run with `pnpm ingest`) that:
1. Walks `./archive/` recursively.
2. Treats files whose names contain `mockup`, `Lookbook`, `_view`, `Hero_`, or anything inside a `mockups/` folder as **display images**. Treats `.pdf` and `_300dpi.png` files as **print masters**. Print masters are not uploaded; only their paths are recorded for the production team.
3. Groups colourways of the same design into one **design family**. For example, `18GTAS_T07_Varsity_Eiteen_A` and `…_B` become one family with two colourways. Use the filename pattern, and write unmatched files to `ingest-report.md` for manual review.
4. Assigns each family a **line** (`EITEEN` or `G-TAS`) and a **collection/round** from its folder. Use the `EITEEN` / `ELDERS` labels already in the Tee Collection 72 filenames where present. Otherwise default to `G-TAS` for XVIII, Luxe, Atelier and monogram work, and to `EITEEN` for pixel, street, map and football work. The admin can edit this afterwards.
5. Converts display images to **WebP** at 1600 px (plus a 480 px thumbnail) with `sharp`, uploads them to **Vercel Blob**, and stores the URLs.
6. Removes exact duplicates using an image hash.
7. Upserts everything into the database. Running it twice must not create duplicates.

Expected scale: about 250–400 design families. Show **one card per family**, with colourway dots to switch between colourways.

---

## 5. Data model (Postgres)

```text
member        (id, name, email UNIQUE, role ENUM('member','admin'), invited_at, created_at)
collection    (id, slug, title, round_label, sort_order)
design        (id, slug UNIQUE, title, line ENUM('EITEEN','G-TAS'), collection_id, description,
               print_method TEXT NULL, tags TEXT[], created_at)
colourway     (id, design_id, name, image_url, thumb_url, print_files JSONB, sort_order)

selection_round (id, title, status ENUM('draft','open','closed','published'),
                 shortlist_size INT DEFAULT 6, opens_at, closes_at)
member_pick     (id, round_id, member_id, design_id, rank INT CHECK (rank BETWEEN 1 AND 6),
                 submitted BOOL, updated_at,
                 UNIQUE(round_id, member_id, rank), UNIQUE(round_id, member_id, design_id))
shortlist       (id, round_id, design_id, points INT, picked_by INT, first_places INT,
                 position INT, tie_break_note TEXT NULL)

public_round  (id, title, mode ENUM('favourite','head_to_head'), status, opens_at, closes_at,
               show_live_results BOOL DEFAULT false, require_email BOOL DEFAULT false)
public_entry  (id, public_round_id, design_id, colourway_id NULL)
vote          (id, public_round_id, entry_id, device_hash, ip_hash, age_bracket NULL,
               province NULL, area NULL, ref NULL, created_at)
matchup       (id, public_round_id, winner_entry_id, loser_entry_id, device_hash, created_at)
audit_log     (id, actor_member_id NULL, action, payload JSONB, created_at)
```

Rules:
- Store only **hashes** of IPs and device IDs: SHA-256 with a server-side salt (`HASH_SALT`).
- Never store raw IP addresses.
- Exactly six picks per member is enforced in the database and in server actions.

---

## 6. Privacy and legal (South Africa)

The public phase targets youth, including under-18s. Build for **POPIA** (Protection of Personal Information Act 4 of 2013):

- **Data minimisation:** voting must work with **no personal information at all**. Age bracket, province and area are optional, and all are anonymous.
- **Children's data:** do not collect names, emails or phone numbers from anyone under 18. Only show the email-code sign-in option after the voter confirms they are 18 or older. POPIA restricts processing children's personal information without a competent person's consent.
- **Privacy notice:** a plain-language notice linked from every page. It must say what is collected (hashed device, optional bracket), why (fair voting), how long it is kept (delete raw vote rows 90 days after a round is published; keep only aggregate totals), and give a contact email.
- **Cookies:** use only one functional vote cookie. Use no advertising trackers.
- **Prizes:** if 18 G-TAS adds a prize draw for voters, it becomes a **promotional competition** under the Consumer Protection Act. Add a "Competition rules" page and get it checked before launch. The platform has a feature flag for this, off by default.
- **Content:** never use club, federation or kit-maker names or logos in design titles or descriptions. Use our own design names, such as "Buccaneer Granite" or "Twelve Voices". Add a check to the ingest report that flags titles containing "Pirates", "Chiefs", "Sundowns", "Bafana", "SAFA", "adidas", "Kappa", "Puma", "Givenchy", "Fendi", "LV" or "Galxboy".

Put the legal pages in `/app/(legal)/privacy` and `/app/(legal)/rules`. Use placeholder text clearly marked **"TO BE REVIEWED"**.

---

## 7. Routes

```
/                         Landing: campaign hero, current phase, call to action
/designs                  Full catalogue (members only during Phase 1; public after, optional)
/designs/[slug]           Design detail: colourways, zoom, line, collection, print method
/members/login            Magic-link sign-in (invite-only)
/members/picks            Pick and rank 6 (drag and drop), progress "4 of 6", Submit (locks)
/members/results          Points table, consensus badges; picks revealed after close
/vote                     Public voting (favourite or head-to-head)
/vote/thanks              Thank-you page with share buttons and referral link
/results                  Public results once published
/admin                    Dashboard: rounds, members, shortlist confirm, toggles, exports
/admin/designs            Edit titles, line, tags, hide or unhide, merge families
/api/og/[slug]            OG share image per design
/privacy, /rules          Legal pages
```

---

## 8. User experience requirements

- **Catalogue:**
  - Filters: line (EITEEN / G-TAS), collection, tee colour, print method.
  - Search, plus "random shuffle" so that early designs don't always sit at the top.
  - Infinite scroll with blurred image placeholders.
- **Picking:**
  - A sticky tray at the bottom of the screen shows the six slots, with drag to reorder and tap to remove.
  - A haptic or visual pulse when a slot fills.
  - It can't be submitted with fewer than 6 picks.
- **Voting:**
  - Full-screen card per design, swipe left or right, a big **Vote** button.
  - After voting, show a confetti burst (respecting `prefers-reduced-motion`).
- **Accessibility:** WCAG 2.1 AA, meaning keyboard navigable, visible focus rings, an alt text on every image (taken from the design title and colourway), and a contrast check on the gold-on-black text.
- **Performance:**
  - Largest Contentful Paint under 2.5 s on a 4G phone.
  - Images served through `next/image` with Blob URLs. Allow the Blob domain in `next.config.ts`.
- **Languages:** English UI. Keep strings in `/messages/en.json` so that isiZulu (`zu.json`) can be added later.

---

## 9. Admin features

- Invite, remove and unlock members, and resend magic links.
- Open and close the members' round. **Auto-close** when all 5 members have submitted.
- Shortlist screen: the computed ranking, a preview of the tie-breaks, an edit for the size (6 to 12), and **Confirm shortlist**. Confirming creates the `public_round` entries.
- Public round controls: mode, open and close times, live results toggle, email requirement toggle, competition flag.
- **Exports (CSV):** member picks, shortlist with points, public votes aggregated by design × age bracket × province. Export aggregates only, never raw hashes.
- **Production hand-off:** for the winners, list the print-master file paths recorded at ingest, so the print team can find the PDFs and PNGs.
- Every admin action writes to `audit_log`.

---

## 10. Environment variables

```
DATABASE_URL=
AUTH_SECRET=
AUTH_EMAIL_FROM="18 G-TAS <vote@yourdomain.co.za>"
RESEND_API_KEY=
BLOB_READ_WRITE_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
HASH_SALT=
ADMIN_EMAILS=admin1@example.com
MEMBER_EMAILS=m1@example.com,m2@example.com,m3@example.com,m4@example.com,m5@example.com
NEXT_PUBLIC_SITE_URL=https://vote.18gtas.co.za
```

Commit `.env.example` with empty values. **Never commit real keys.**

---

## 11. GitHub → Vercel deployment

1. Create a GitHub repo, e.g. `18gtas-design-vote`. Protect `main` with required checks: lint, typecheck, tests.
2. In Vercel, use **Add New → Project → Import** the repo. Framework: Next.js.
3. From the Vercel Marketplace, add **Neon Postgres**, **Upstash Redis** and **Blob** storage. These set most environment variables automatically. Add the rest by hand in Project Settings → Environment Variables, for Production and Preview.
4. Run migrations on deploy with `pnpm db:migrate` in the build step, or as a GitHub Action before promotion.
5. Run `pnpm ingest` **locally** against the production database and Blob store once the archive is unzipped. Re-run it any time new design rounds are added.
6. Add a custom domain such as `vote.18gtas.co.za` in Vercel Domains.
7. Every pull request gets a preview URL. Share previews with the five members for UI feedback before launch.

---

## 12. Build order (for Claude Code)

Work in this order. Open one pull request per step, keep it green, and update the checklist.

- [x] **1. Scaffold:** Next.js + TypeScript + Tailwind with the brand tokens and fonts, ESLint and Prettier, Vitest, Playwright, GitHub Actions CI.
- [x] **2. Database:** Drizzle schema (section 5), migrations, seed script (members, admin, one draft round).
- [x] **3. Ingest:** `scripts/ingest.ts` (section 4) with `ingest-report.md`, family grouping, WebP and Blob upload, and the brand-name content check.
- [x] **4. Catalogue:** `/designs` and `/designs/[slug]` with filters, colourway switcher and zoom.
- [x] **5. Member auth:** invite-only sign-in (WhatsApp invite links, §0.9); `proxy.ts` protecting `/members/*`, `/admin/*` and `/designs/*`, plus a session check in every page and action.
- [ ] **6. Picks:** pick tray, ranking, submit and lock; database constraints; unit tests for exactly-six and unique-rank rules.
- [ ] **7. Scoring:** Borda count, tie-breaks 1–3, results page; unit tests covering ties.
- [ ] **8. Admin:** rounds, shortlist confirmation, unlock, exports, audit log.
- [ ] **9. Public vote:** favourite mode, Turnstile, rate limiting, device cookie and hash, optional demographics, thanks page.
- [ ] **10. Head-to-head:** matchup flow, Elo or Bradley-Terry ranking with unit tests.
- [ ] **11. Sharing:** OG images per design, referral `?ref=` tracking.
- [ ] **12. Legal and privacy:** pages, retention job (Vercel Cron) deleting raw vote rows 90 days after publish.
- [ ] **13. Polish:** accessibility audit, Lighthouse ≥ 90 on mobile, reduced-motion support, empty and error states.
- [ ] **14. Launch checklist:** environment variables set, domain live, test round run end to end with the five members, admin password manager handover.

---

## 13. Acceptance criteria

1. All five members can sign in with their email only, pick and rank exactly six designs, and submit. Picks lock on submit.
2. No member can see another member's picks before the round closes.
3. When all five have submitted, the shortlist is computed with Borda points and tie-breaks. Confirming it opens a public round with those designs.
4. A member of the public can vote on a phone in under 30 seconds without creating an account.
5. A second vote from the same device in the same round is refused politely. Bots fail the Turnstile check.
6. No raw IP addresses, names, emails or phone numbers of under-18 voters are ever stored.
7. Results can be published, shared, and exported as aggregate CSVs.
8. The repo deploys from GitHub to Vercel with preview URLs per pull request and green CI.

---

## 14. Notes for Claude Code

- Ask before adding any new paid service.
- Keep design titles as they appear in the archive filenames, cleaned up: underscores become spaces, colourway suffixes `_A` and `_B` are removed.
- If a file can't be classified during ingest, never guess silently. Put it in `ingest-report.md`.
- Keep components small and typed. Write server-side validation with Zod.
- Before marking a step done, write the tests for its scoring, tie-breaks and vote rules.
