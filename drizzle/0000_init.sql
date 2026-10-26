CREATE TABLE "companies" (
	"symbol" text PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"name" text NOT NULL,
	"fiscal_year_end_month" integer NOT NULL,
	"concept_map_version" text
);
--> statement-breakpoint
CREATE TABLE "derived_values" (
	"derived_id" text NOT NULL,
	"obs_date" date NOT NULL,
	"value" double precision,
	"formula_version" integer NOT NULL,
	"input_status" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "derived_values_derived_id_obs_date_pk" PRIMARY KEY("derived_id","obs_date")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"source_url" text NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL,
	"series_ids" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"accession_no" text PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"form" text NOT NULL,
	"period_end" date,
	"filed_at" date NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"rows_written" integer DEFAULT 0 NOT NULL,
	"latency_seconds" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "intraday_snapshots" (
	"symbol" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"price" double precision NOT NULL,
	"provider_ts" timestamp with time zone,
	CONSTRAINT "intraday_snapshots_symbol_captured_at_pk" PRIMARY KEY("symbol","captured_at")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"obs_date" date NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source_url" text NOT NULL,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observation_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"obs_date" date NOT NULL,
	"previous_value" double precision NOT NULL,
	"previous_fetched_at" timestamp with time zone NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"series_id" text NOT NULL,
	"obs_date" date NOT NULL,
	"value" double precision NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"source_ref" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "observations_series_id_obs_date_pk" PRIMARY KEY("series_id","obs_date")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"name_zh" text NOT NULL,
	"unit" text NOT NULL,
	"frequency" text NOT NULL,
	"seasonal_adjustment" text,
	"category" text NOT NULL,
	"copyright_holder" text,
	"valid_min" double precision,
	"valid_max" double precision,
	"jump_sigma" double precision,
	"release_lag_days" integer,
	"timeliness_target_minutes" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signal_rule_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"state" text NOT NULL,
	"previous_state" text,
	"inputs" jsonb NOT NULL,
	"rule_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universe_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universe_members" (
	"symbol" text PRIMARY KEY NOT NULL,
	"layer" text NOT NULL,
	"cyclicality" text NOT NULL,
	"in_hyperscaler_capex" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeat" (
	"id" text PRIMARY KEY NOT NULL,
	"beat_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_entries" ADD CONSTRAINT "manual_entries_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_revisions" ADD CONSTRAINT "observation_revisions_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_scheduled_at" ON "events" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "ingest_runs_job" ON "ingest_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "login_attempts_source" ON "login_attempts" USING btree ("source_key","created_at");--> statement-breakpoint
CREATE INDEX "manual_entries_series_date" ON "manual_entries" USING btree ("series_id","obs_date");--> statement-breakpoint
CREATE INDEX "observation_revisions_series_date" ON "observation_revisions" USING btree ("series_id","obs_date");--> statement-breakpoint
CREATE INDEX "signal_states_rule" ON "signal_states" USING btree ("rule_id","created_at");