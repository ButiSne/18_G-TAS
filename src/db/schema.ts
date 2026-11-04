import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["member", "admin"]);
export const designLine = pgEnum("design_line", ["EITEEN", "G-TAS"]);
export const roundStatus = pgEnum("round_status", ["draft", "open", "closed", "published"]);
// "swipe" is the default public mode (CLAUDE.md §0.7). It is set in code when a public
// round is created, not as a column default: Postgres cannot use a newly added enum value
// in the same transaction that adds it.
export const publicMode = pgEnum("public_mode", ["favourite", "head_to_head", "swipe"]);
export const finalSlot = pgEnum("final_slot", ["sublimation", "other"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const member = pgTable("member", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: memberRole("role").notNull().default("member"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const collection = pgTable("collection", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  roundLabel: text("round_label"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const design = pgTable("design", {
  id: id(),
  slug: text("slug").notNull().unique(),
  // "<collection slug>/<family no>" from ingest (e.g. "tee-collection-72/t07"). Ingest
  // upserts on it, so re-runs update the same row even if the admin renames the title.
  familyKey: text("family_key").unique(),
  title: text("title").notNull(),
  line: designLine("line").notNull(),
  collectionId: uuid("collection_id").references(() => collection.id),
  description: text("description"),
  // Validated against src/lib/print-methods.ts in server actions rather than a DB enum,
  // because the owner has not confirmed the list yet and an enum change is a migration.
  printMethod: text("print_method"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  hidden: boolean("hidden").notNull().default(false),
  // Print masters that belong to the design as a whole (shared artwork, logo masters).
  // Per-colourway files live on colourway.print_files. Paths only, relative to archive/.
  printFiles: jsonb("print_files").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
});

export const colourway = pgTable("colourway", {
  id: id(),
  designId: uuid("design_id")
    .notNull()
    .references(() => design.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbUrl: text("thumb_url").notNull(),
  imageHash: text("image_hash").notNull().unique(),
  // A tiny WebP as a data URL: an instant placeholder while the real image loads on 4G.
  blurDataUrl: text("blur_data_url"),
  // Extra views of this colourway (close-up detail shots), shown in the zoom.
  views: jsonb("views").$type<{ imageUrl: string; thumbUrl: string }[]>().notNull().default([]),
  // Canonical tee colour for the catalogue filter (src/ingest/tee-colour.ts).
  teeColour: text("tee_colour"),
  // Paths only. Print masters are never uploaded; the print team finds them in the archive.
  printFiles: jsonb("print_files").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

// --- Stage 1: team round -------------------------------------------------------

export const selectionRound = pgTable(
  "selection_round",
  {
    id: id(),
    title: text("title").notNull(),
    status: roundStatus("status").notNull().default("draft"),
    picksPerMember: integer("picks_per_member").notNull().default(6),
    shortlistSize: integer("shortlist_size").notNull().default(20),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("picks_per_member_range", sql`${t.picksPerMember} BETWEEN 1 AND 20`),
    check("shortlist_size_range", sql`${t.shortlistSize} BETWEEN 10 AND 40`),
  ],
);

// Who is on the team for this round. The admin decides per round (CLAUDE.md §0.2),
// and "everyone has submitted" — the auto-close trigger — means everyone listed here.
export const roundMember = pgTable(
  "round_member",
  {
    id: id(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => selectionRound.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [unique("round_member_once").on(t.roundId, t.memberId)],
);

export const memberPick = pgTable(
  "member_pick",
  {
    id: id(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => selectionRound.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    designId: uuid("design_id")
      .notNull()
      .references(() => design.id),
    rank: integer("rank").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("member_pick_rank").on(t.roundId, t.memberId, t.rank),
    unique("member_pick_design").on(t.roundId, t.memberId, t.designId),
    // The upper bound is the round's picks_per_member, which a CHECK cannot see;
    // validatePicks() enforces it in the server action.
    check("member_pick_rank_positive", sql`${t.rank} >= 1`),
  ],
);

export const shortlist = pgTable(
  "shortlist",
  {
    id: id(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => selectionRound.id),
    designId: uuid("design_id")
      .notNull()
      .references(() => design.id),
    points: integer("points").notNull(),
    pickedBy: integer("picked_by").notNull(),
    firstPlaces: integer("first_places").notNull(),
    position: integer("position").notNull(),
    tieBreakNote: text("tie_break_note"),
  },
  (t) => [unique("shortlist_once").on(t.roundId, t.designId)],
);

// --- Stage 2: public round -----------------------------------------------------

export const publicRound = pgTable("public_round", {
  id: id(),
  selectionRoundId: uuid("selection_round_id").references(() => selectionRound.id),
  title: text("title").notNull(),
  createdAt: createdAt(),
  mode: publicMode("mode").notNull().default("favourite"),
  status: roundStatus("status").notNull().default("draft"),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  showLiveResults: boolean("show_live_results").notNull().default(false),
  requireEmail: boolean("require_email").notNull().default(false),
  competition: boolean("competition").notNull().default(false),
  // Frozen results, written when raw votes are deleted 90 days after publishing (brief §6),
  // so the results page keeps working without any per-device rows.
  resultsSnapshot: jsonb("results_snapshot"),
});

export const publicEntry = pgTable(
  "public_entry",
  {
    id: id(),
    publicRoundId: uuid("public_round_id")
      .notNull()
      .references(() => publicRound.id, { onDelete: "cascade" }),
    designId: uuid("design_id")
      .notNull()
      .references(() => design.id),
    colourwayId: uuid("colourway_id").references(() => colourway.id),
  },
  (t) => [unique("public_entry_once").on(t.publicRoundId, t.designId)],
);

// Hashes only: SHA-256 with HASH_SALT. A raw IP or device id never reaches this table.
export const vote = pgTable(
  "vote",
  {
    id: id(),
    publicRoundId: uuid("public_round_id")
      .notNull()
      .references(() => publicRound.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => publicEntry.id),
    deviceHash: text("device_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    ageBracket: text("age_bracket"),
    province: text("province"),
    area: text("area"),
    ref: text("ref"),
    createdAt: createdAt(),
  },
  (t) => [unique("vote_one_per_device").on(t.publicRoundId, t.deviceHash)],
);

// Swipe mode: one YEBO (liked) or CHA per design per device. Hashes only, like `vote`.
export const swipe = pgTable(
  "swipe",
  {
    id: id(),
    publicRoundId: uuid("public_round_id")
      .notNull()
      .references(() => publicRound.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => publicEntry.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    liked: boolean("liked").notNull(),
    ageBracket: text("age_bracket"),
    province: text("province"),
    ref: text("ref"),
    createdAt: createdAt(),
  },
  (t) => [unique("swipe_once_per_device").on(t.publicRoundId, t.deviceHash, t.entryId)],
);

// Totals kept after raw swipes are deleted 90 days after publish (brief §6).
export const swipeAggregate = pgTable(
  "swipe_aggregate",
  {
    id: id(),
    publicRoundId: uuid("public_round_id")
      .notNull()
      .references(() => publicRound.id),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => publicEntry.id),
    ref: text("ref"),
    ageBracket: text("age_bracket"),
    province: text("province"),
    likes: integer("likes").notNull(),
    passes: integer("passes").notNull(),
  },
  (t) => [
    unique("swipe_aggregate_cell")
      .on(t.publicRoundId, t.entryId, t.ref, t.ageBracket, t.province)
      .nullsNotDistinct(),
  ],
);

export const matchup = pgTable("matchup", {
  id: id(),
  publicRoundId: uuid("public_round_id")
    .notNull()
    .references(() => publicRound.id, { onDelete: "cascade" }),
  winnerEntryId: uuid("winner_entry_id")
    .notNull()
    .references(() => publicEntry.id),
  loserEntryId: uuid("loser_entry_id")
    .notNull()
    .references(() => publicEntry.id),
  deviceHash: text("device_hash").notNull(),
  ref: text("ref"),
  createdAt: createdAt(),
});

// Aggregates kept after raw vote rows are deleted 90 days after publish (brief §6).
export const voteAggregate = pgTable(
  "vote_aggregate",
  {
    id: id(),
    publicRoundId: uuid("public_round_id")
      .notNull()
      .references(() => publicRound.id),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => publicEntry.id),
    ageBracket: text("age_bracket"),
    province: text("province"),
    ref: text("ref"),
    votes: integer("votes").notNull(),
  },
  (t) => [
    unique("vote_aggregate_cell")
      .on(t.publicRoundId, t.entryId, t.ageBracket, t.province, t.ref)
      .nullsNotDistinct(),
  ],
);

// --- Stage 3: final ten --------------------------------------------------------

export const finalSelection = pgTable(
  "final_selection",
  {
    id: id(),
    publicRoundId: uuid("public_round_id")
      .notNull()
      .references(() => publicRound.id),
    designId: uuid("design_id")
      .notNull()
      .references(() => design.id),
    slot: finalSlot("slot").notNull(),
    // Copied at decision time so the record still says what was decided if the
    // design's print method is edited later.
    printMethod: text("print_method").notNull(),
    position: integer("position").notNull(),
    note: text("note"),
    decidedBy: uuid("decided_by").references(() => member.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("final_selection_once").on(t.publicRoundId, t.designId),
    check("final_selection_position", sql`${t.position} BETWEEN 1 AND 10`),
  ],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorMemberId: uuid("actor_member_id").references(() => member.id),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: createdAt(),
});

// --- Team sign-in: WhatsApp invite links (CLAUDE.md §0.9) ------------------------
// Tokens are random and only their SHA-256 hashes are stored, so a database leak does not
// hand out working links or sessions.

export const invite = pgTable("invite", {
  id: id(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => member.id),
  createdAt: createdAt(),
});

export const session = pgTable("session", {
  id: id(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Fixed-window request counters for rate limiting, in Postgres rather than a new service.
// Keys hold only salted hashes (e.g. "swipe:dev:<hash>"); stale rows are swept daily.
export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
