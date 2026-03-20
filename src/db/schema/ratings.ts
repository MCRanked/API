import {
	boolean,
	index,
	integer,
	pgTable,
	serial,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { kits } from "./kits";
import { seasons } from "./seasons";
import { users } from "./users";

export const ratings = pgTable(
	"ratings",
	{
		id: serial("id").primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		seasonId: integer("season_id")
			.references(() => seasons.id)
			.notNull(),
		elo: integer("elo").notNull(),
		peakElo: integer("peak_elo").notNull(),
		rank: varchar("rank", { length: 32 }),
		gamesPlayed: integer("games_played").default(0).notNull(),
		wins: integer("wins").default(0).notNull(),
		losses: integer("losses").default(0).notNull(),
		winStreak: integer("win_streak").default(0).notNull(),
		bestWinStreak: integer("best_win_streak").default(0).notNull(),
		placementDone: boolean("placement_done").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique().on(table.userId, table.kitId, table.seasonId),
		index("ratings_leaderboard_idx").on(table.kitId, table.seasonId, table.elo),
	],
);
