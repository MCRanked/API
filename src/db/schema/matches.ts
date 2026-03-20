import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { kits } from "./kits";
import { seasons } from "./seasons";
import { users } from "./users";

export const matches = pgTable(
	"matches",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		seasonId: integer("season_id")
			.references(() => seasons.id)
			.notNull(),
		winnerId: uuid("winner_id").references(() => users.id),
		loserId: uuid("loser_id").references(() => users.id),
		winnerEloBefore: integer("winner_elo_before"),
		winnerEloAfter: integer("winner_elo_after"),
		loserEloBefore: integer("loser_elo_before"),
		loserEloAfter: integer("loser_elo_after"),
		winnerEloDelta: integer("winner_elo_delta"),
		loserEloDelta: integer("loser_elo_delta"),
		decisivenessScore: real("decisiveness_score").notNull(),
		integrityScore: real("integrity_score").notNull(),
		region: varchar("region", { length: 16 }).notNull(),
		nodeId: varchar("node_id", { length: 64 }).notNull(),
		durationMs: integer("duration_ms").notNull(),
		metadata: jsonb("metadata"),
		status: varchar("status", { length: 16 }).notNull(),
		playedAt: timestamp("played_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"decisiveness_score_range",
			sql`${table.decisivenessScore} >= 0 AND ${table.decisivenessScore} <= 1`,
		),
		check(
			"integrity_score_range",
			sql`${table.integrityScore} >= 0 AND ${table.integrityScore} <= 1`,
		),
		index("matches_winner_idx").on(table.winnerId, table.playedAt),
		index("matches_loser_idx").on(table.loserId, table.playedAt),
		index("matches_kit_season_idx").on(
			table.kitId,
			table.seasonId,
			table.playedAt,
		),
	],
);
