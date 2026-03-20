CREATE TABLE "kits" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"version_range" varchar(32) NOT NULL,
	"ruleset" jsonb NOT NULL,
	"default_inventory" jsonb,
	"allow_custom_loadouts" boolean DEFAULT false,
	"icon" varchar(255),
	"category" varchar(32),
	"display_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kits_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"winner_id" uuid,
	"loser_id" uuid,
	"winner_elo_before" integer,
	"winner_elo_after" integer,
	"loser_elo_before" integer,
	"loser_elo_after" integer,
	"winner_elo_delta" integer,
	"loser_elo_delta" integer,
	"decisiveness_score" real NOT NULL,
	"integrity_score" real NOT NULL,
	"region" varchar(16) NOT NULL,
	"node_id" varchar(64) NOT NULL,
	"duration_ms" integer NOT NULL,
	"metadata" jsonb,
	"status" varchar(16) NOT NULL,
	"played_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "decisiveness_score_range" CHECK ("matches"."decisiveness_score" >= 0 AND "matches"."decisiveness_score" <= 1),
	CONSTRAINT "integrity_score_range" CHECK ("matches"."integrity_score" >= 0 AND "matches"."integrity_score" <= 1)
);
--> statement-breakpoint
CREATE TABLE "player_loadouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" integer NOT NULL,
	"name" varchar(32) DEFAULT 'default' NOT NULL,
	"inventory" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_loadouts_user_id_kit_id_name_unique" UNIQUE("user_id","kit_id","name")
);
--> statement-breakpoint
CREATE TABLE "punishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"reason" text NOT NULL,
	"evidence_ref" varchar(255),
	"issued_by" varchar(64) NOT NULL,
	"expires_at" timestamp,
	"revoked" boolean DEFAULT false NOT NULL,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kit_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"elo" integer NOT NULL,
	"peak_elo" integer NOT NULL,
	"rank" varchar(32),
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"win_streak" integer DEFAULT 0 NOT NULL,
	"best_win_streak" integer DEFAULT 0 NOT NULL,
	"placement_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_id_kit_id_season_id_unique" UNIQUE("user_id","kit_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_id" integer NOT NULL,
	"number" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"active" boolean DEFAULT false,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_kit_id_number_unique" UNIQUE("kit_id","number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"minecraft_uuid" varchar(36) NOT NULL,
	"username" varchar(16) NOT NULL,
	"microsoft_id" varchar(255),
	"refresh_token" varchar(255),
	"version_preference" varchar(32) DEFAULT '1.8',
	"language" varchar(8) DEFAULT 'en',
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	CONSTRAINT "users_minecraft_uuid_unique" UNIQUE("minecraft_uuid")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_loser_id_users_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_loadouts" ADD CONSTRAINT "player_loadouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_loadouts" ADD CONSTRAINT "player_loadouts_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punishments" ADD CONSTRAINT "punishments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_winner_idx" ON "matches" USING btree ("winner_id","played_at");--> statement-breakpoint
CREATE INDEX "matches_loser_idx" ON "matches" USING btree ("loser_id","played_at");--> statement-breakpoint
CREATE INDEX "matches_kit_season_idx" ON "matches" USING btree ("kit_id","season_id","played_at");--> statement-breakpoint
CREATE INDEX "loadouts_user_kit_idx" ON "player_loadouts" USING btree ("user_id","kit_id");--> statement-breakpoint
CREATE INDEX "punishments_user_idx" ON "punishments" USING btree ("user_id","revoked");--> statement-breakpoint
CREATE INDEX "ratings_leaderboard_idx" ON "ratings" USING btree ("kit_id","season_id","elo");