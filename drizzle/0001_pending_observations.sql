CREATE TABLE "pending_observations" (
	"series_id" text NOT NULL,
	"obs_date" date NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source_ref" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"issues" jsonb NOT NULL,
	CONSTRAINT "pending_observations_series_id_obs_date_pk" PRIMARY KEY("series_id","obs_date")
);
--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "calendar" text;--> statement-breakpoint
ALTER TABLE "pending_observations" ADD CONSTRAINT "pending_observations_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" DROP COLUMN "status";