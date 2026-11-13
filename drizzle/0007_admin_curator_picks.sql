CREATE TYPE "public"."round_role" AS ENUM('picker', 'curator');--> statement-breakpoint
ALTER TABLE "round_member" ADD COLUMN "role" "round_role" DEFAULT 'picker' NOT NULL;--> statement-breakpoint
ALTER TABLE "shortlist" ADD COLUMN "admin_choice" boolean DEFAULT false NOT NULL;