CREATE TABLE "ballot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_round_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ballot_once_per_device" UNIQUE("public_round_id","device_hash")
);
--> statement-breakpoint
ALTER TABLE "swipe" ALTER COLUMN "ip_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vote" ALTER COLUMN "ip_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ballot" ADD CONSTRAINT "ballot_public_round_id_public_round_id_fk" FOREIGN KEY ("public_round_id") REFERENCES "public"."public_round"("id") ON DELETE cascade ON UPDATE no action;