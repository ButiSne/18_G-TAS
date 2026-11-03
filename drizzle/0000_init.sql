CREATE TYPE "public"."design_line" AS ENUM('EITEEN', 'G-TAS');--> statement-breakpoint
CREATE TYPE "public"."final_slot" AS ENUM('sublimation', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."public_mode" AS ENUM('favourite', 'head_to_head');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('draft', 'open', 'closed', 'published');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_member_id" uuid,
	"action" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"round_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "colourway" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"image_hash" text NOT NULL,
	"print_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "colourway_image_hash_unique" UNIQUE("image_hash")
);
--> statement-breakpoint
CREATE TABLE "design" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"line" "design_line" NOT NULL,
	"collection_id" uuid,
	"description" text,
	"print_method" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "final_selection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"slot" "final_slot" NOT NULL,
	"print_method" text NOT NULL,
	"position" integer NOT NULL,
	"note" text,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_selection_once" UNIQUE("public_round_id","design_id"),
	CONSTRAINT "final_selection_position" CHECK ("final_selection"."position" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "matchup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"winner_entry_id" uuid NOT NULL,
	"loser_entry_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "member_pick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_pick_rank" UNIQUE("round_id","member_id","rank"),
	CONSTRAINT "member_pick_design" UNIQUE("round_id","member_id","design_id"),
	CONSTRAINT "member_pick_rank_positive" CHECK ("member_pick"."rank" >= 1)
);
--> statement-breakpoint
CREATE TABLE "public_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"colourway_id" uuid,
	CONSTRAINT "public_entry_once" UNIQUE("public_round_id","design_id")
);
--> statement-breakpoint
CREATE TABLE "public_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_round_id" uuid,
	"title" text NOT NULL,
	"mode" "public_mode" DEFAULT 'favourite' NOT NULL,
	"status" "round_status" DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"show_live_results" boolean DEFAULT false NOT NULL,
	"require_email" boolean DEFAULT false NOT NULL,
	"competition" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "round_member_once" UNIQUE("round_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "selection_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" "round_status" DEFAULT 'draft' NOT NULL,
	"picks_per_member" integer DEFAULT 6 NOT NULL,
	"shortlist_size" integer DEFAULT 20 NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "picks_per_member_range" CHECK ("selection_round"."picks_per_member" BETWEEN 1 AND 20),
	CONSTRAINT "shortlist_size_range" CHECK ("selection_round"."shortlist_size" BETWEEN 10 AND 40)
);
--> statement-breakpoint
CREATE TABLE "shortlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"picked_by" integer NOT NULL,
	"first_places" integer NOT NULL,
	"position" integer NOT NULL,
	"tie_break_note" text,
	CONSTRAINT "shortlist_once" UNIQUE("round_id","design_id")
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"ip_hash" text NOT NULL,
	"age_bracket" text,
	"province" text,
	"area" text,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_one_per_device" UNIQUE("public_round_id","device_hash")
);
--> statement-breakpoint
CREATE TABLE "vote_aggregate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"age_bracket" text,
	"province" text,
	"ref" text,
	"votes" integer NOT NULL,
	CONSTRAINT "vote_aggregate_cell" UNIQUE NULLS NOT DISTINCT("public_round_id","entry_id","age_bracket","province","ref")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_member_id_member_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colourway" ADD CONSTRAINT "colourway_design_id_design_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."design"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design" ADD CONSTRAINT "design_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_selection" ADD CONSTRAINT "final_selection_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_selection" ADD CONSTRAINT "final_selection_design_id_design_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."design"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_selection" ADD CONSTRAINT "final_selection_decided_by_member_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_winner_entry_id_public_entry_id_fk" FOREIGN KEY ("winner_entry_id") REFERENCES "public"."public_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_loser_entry_id_public_entry_id_fk" FOREIGN KEY ("loser_entry_id") REFERENCES "public"."public_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_pick" ADD CONSTRAINT "member_pick_round_id_selection_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."selection_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_pick" ADD CONSTRAINT "member_pick_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_pick" ADD CONSTRAINT "member_pick_design_id_design_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."design"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_entry" ADD CONSTRAINT "public_entry_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_entry" ADD CONSTRAINT "public_entry_design_id_design_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."design"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_entry" ADD CONSTRAINT "public_entry_colourway_id_colourway_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourway"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_round" ADD CONSTRAINT "public_round_selection_round_id_selection_round_id_fk" FOREIGN KEY ("selection_round_id") REFERENCES "public"."selection_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_member" ADD CONSTRAINT "round_member_round_id_selection_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."selection_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_member" ADD CONSTRAINT "round_member_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist" ADD CONSTRAINT "shortlist_round_id_selection_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."selection_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist" ADD CONSTRAINT "shortlist_design_id_design_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."design"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_entry_id_public_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."public_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_aggregate" ADD CONSTRAINT "vote_aggregate_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_aggregate" ADD CONSTRAINT "vote_aggregate_entry_id_public_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."public_entry"("id") ON DELETE no action ON UPDATE no action;