ALTER TYPE "public"."public_mode" ADD VALUE 'swipe';--> statement-breakpoint
CREATE TABLE "swipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"ip_hash" text NOT NULL,
	"liked" boolean NOT NULL,
	"age_bracket" text,
	"province" text,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipe_once_per_device" UNIQUE("public_round_id","device_hash","entry_id")
);
--> statement-breakpoint
CREATE TABLE "swipe_aggregate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"ref" text,
	"age_bracket" text,
	"province" text,
	"likes" integer NOT NULL,
	"passes" integer NOT NULL,
	CONSTRAINT "swipe_aggregate_cell" UNIQUE NULLS NOT DISTINCT("public_round_id","entry_id","ref","age_bracket","province")
);
--> statement-breakpoint
ALTER TABLE "public_round" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_entry_id_public_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."public_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_aggregate" ADD CONSTRAINT "swipe_aggregate_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_aggregate" ADD CONSTRAINT "swipe_aggregate_entry_id_public_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."public_entry"("id") ON DELETE no action ON UPDATE no action;