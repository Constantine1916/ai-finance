ALTER TABLE "events" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "origin" text DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_key_unique" UNIQUE("key");