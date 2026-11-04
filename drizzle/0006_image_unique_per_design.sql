ALTER TABLE "colourway" DROP CONSTRAINT "colourway_image_hash_unique";--> statement-breakpoint
ALTER TABLE "colourway" ADD CONSTRAINT "colourway_design_image" UNIQUE("design_id","image_hash");