CREATE TYPE "public"."pick_note_kind" AS ENUM('comment', 'suggestion');--> statement-breakpoint
ALTER TABLE "colourway" ADD COLUMN "tee_hex" text;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "placement" text;--> statement-breakpoint
ALTER TABLE "member_pick" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "member_pick" ADD COLUMN "note_kind" "pick_note_kind";--> statement-breakpoint
ALTER TABLE "round_member" ADD COLUMN "suggestion" text;--> statement-breakpoint
ALTER TABLE "member_pick" ADD CONSTRAINT "member_pick_note_length" CHECK (char_length("member_pick"."note") <= 280);--> statement-breakpoint
ALTER TABLE "member_pick" ADD CONSTRAINT "member_pick_note_kind" CHECK (("member_pick"."note" IS NULL) = ("member_pick"."note_kind" IS NULL));--> statement-breakpoint
ALTER TABLE "round_member" ADD CONSTRAINT "round_member_suggestion_length" CHECK (char_length("round_member"."suggestion") <= 500);--> statement-breakpoint
-- Print methods moved to the owner's list from the design pack (src/lib/print-methods.ts).
UPDATE "design" SET "print_method" = CASE "print_method"
  WHEN 'sublimation' THEN 'full-sublimation'
  WHEN 'puff' THEN 'puff-print'
  WHEN 'embroidery' THEN 'embroidery-or-dtf'
  ELSE NULL END
WHERE "print_method" IN ('sublimation', 'puff', 'embroidery', 'screen_print', 'vinyl');
