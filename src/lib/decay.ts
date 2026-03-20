import { and, eq, gte, lt } from "drizzle-orm";
import { ratings, seasons } from "../db/schema";
import { deriveRank, type SeasonConfig } from "./elo";

export function decayRating(
	currentElo: number,
	pointsPerDay: number,
	floorElo: number,
): number {
	return Math.max(floorElo, currentElo - pointsPerDay);
}

export async function runDecay() {
	// Lazy import to avoid triggering DB connection at module load time
	const { db } = await import("../db");

	const activeSeasons = await db.query.seasons.findMany({
		where: eq(seasons.active, true),
	});

	for (const season of activeSeasons) {
		const config = season.config as SeasonConfig;
		if (!config.decay.enabled) continue;

		const cutoff = new Date(
			Date.now() - config.decay.inactivity_days * 24 * 60 * 60 * 1000,
		);

		// Find ratings eligible for decay
		const staleRatings = await db.query.ratings.findMany({
			where: and(
				eq(ratings.seasonId, season.id),
				gte(ratings.elo, config.decay.min_elo),
				lt(ratings.updatedAt, cutoff),
			),
		});

		const now = new Date();
		for (const rating of staleRatings) {
			const newElo = decayRating(
				rating.elo,
				config.decay.points_per_day,
				config.decay.floor_elo,
			);
			const newRank = deriveRank(newElo, rating.placementDone, config);

			await db
				.update(ratings)
				.set({
					elo: newElo,
					rank: newRank,
					updatedAt: now,
				})
				.where(eq(ratings.id, rating.id));
		}

		console.log(
			`Decay: processed ${staleRatings.length} ratings for season ${season.id}`,
		);
	}
}
