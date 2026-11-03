ALTER TABLE "colourway" ADD COLUMN "blur_data_url" text;--> statement-breakpoint
ALTER TABLE "colourway" ADD COLUMN "views" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "colourway" ADD COLUMN "tee_colour" text;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "family_key" text;--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "print_files" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "design" ADD CONSTRAINT "design_family_key_unique" UNIQUE("family_key");