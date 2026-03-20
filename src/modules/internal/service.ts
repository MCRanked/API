import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
	kits,
	matches,
	playerLoadouts,
	punishments,
	ratings,
	seasons,
	users,
} from "../../db/schema";
import { calculateElo, deriveRank, type SeasonConfig } from "../../lib/elo";
import { ApiError } from "../../middleware/error";

interface MatchSubmission {
	kit_id: number;
	winner_minecraft_uuid: string;
	loser_minecraft_uuid: string;
	region: string;
	node_id: string;
	duration_ms: number;
	decisiveness_score: number;
	integrity_score: number;
	metadata?: Record<string, unknown>;
}

export async function submitMatch(input: MatchSubmission) {
	// Resolve players
	const winner = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, input.winner_minecraft_uuid),
	});
	const loser = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, input.loser_minecraft_uuid),
	});
	if (!winner || !loser) {
		throw new ApiError(404, "NOT_FOUND", "Player not found");
	}

	// Resolve active season for this kit
	const activeSeason = await db.query.seasons.findFirst({
		where: and(eq(seasons.kitId, input.kit_id), eq(seasons.active, true)),
	});
	if (!activeSeason) {
		throw new ApiError(
			400,
			"VALIDATION_ERROR",
			"No active season for this kit",
		);
	}

	const config = activeSeason.config as SeasonConfig;

	// Get or create ratings for both players
	const winnerRating = await getOrCreateRating(
		winner.id,
		input.kit_id,
		activeSeason.id,
		config,
	);
	const loserRating = await getOrCreateRating(
		loser.id,
		input.kit_id,
		activeSeason.id,
		config,
	);

	// Calculate Elo
	const eloResult = calculateElo({
		winnerElo: winnerRating.elo,
		loserElo: loserRating.elo,
		winnerGamesPlayed: winnerRating.gamesPlayed,
		loserGamesPlayed: loserRating.gamesPlayed,
		decisivenessScore: input.decisiveness_score,
		integrityScore: input.integrity_score,
		config,
	});

	const winnerNewGames = winnerRating.gamesPlayed + 1;
	const loserNewGames = loserRating.gamesPlayed + 1;
	const winnerPlacementDone =
		winnerRating.placementDone ||
		winnerNewGames >= config.elo.placement_matches;
	const loserPlacementDone =
		loserRating.placementDone || loserNewGames >= config.elo.placement_matches;

	const now = new Date();

	// Transaction: all three writes must succeed or none
	const [match] = await db.transaction(async (tx) => {
		// Update winner rating
		await tx
			.update(ratings)
			.set({
				elo: eloResult.winnerNewElo,
				peakElo: Math.max(winnerRating.peakElo, eloResult.winnerNewElo),
				gamesPlayed: winnerNewGames,
				wins: winnerRating.wins + 1,
				winStreak: winnerRating.winStreak + 1,
				bestWinStreak: Math.max(
					winnerRating.bestWinStreak,
					winnerRating.winStreak + 1,
				),
				placementDone: winnerPlacementDone,
				rank: deriveRank(eloResult.winnerNewElo, winnerPlacementDone, config),
				updatedAt: now,
			})
			.where(eq(ratings.id, winnerRating.id));

		// Update loser rating
		await tx
			.update(ratings)
			.set({
				elo: eloResult.loserNewElo,
				gamesPlayed: loserNewGames,
				losses: loserRating.losses + 1,
				winStreak: 0,
				placementDone: loserPlacementDone,
				rank: deriveRank(eloResult.loserNewElo, loserPlacementDone, config),
				updatedAt: now,
			})
			.where(eq(ratings.id, loserRating.id));

		// Insert match record
		return tx
			.insert(matches)
			.values({
				kitId: input.kit_id,
				seasonId: activeSeason.id,
				winnerId: winner.id,
				loserId: loser.id,
				winnerEloBefore: winnerRating.elo,
				winnerEloAfter: eloResult.winnerNewElo,
				loserEloBefore: loserRating.elo,
				loserEloAfter: eloResult.loserNewElo,
				winnerEloDelta: eloResult.winnerDelta,
				loserEloDelta: eloResult.loserDelta,
				decisivenessScore: input.decisiveness_score,
				integrityScore: input.integrity_score,
				region: input.region,
				nodeId: input.node_id,
				durationMs: input.duration_ms,
				metadata: input.metadata ?? {},
				status: "completed",
				playedAt: now,
			})
			.returning();
	});

	return match;
}

async function getOrCreateRating(
	userId: string,
	kitId: number,
	seasonId: number,
	config: SeasonConfig,
) {
	const existing = await db.query.ratings.findFirst({
		where: and(
			eq(ratings.userId, userId),
			eq(ratings.kitId, kitId),
			eq(ratings.seasonId, seasonId),
		),
	});

	if (existing) return existing;

	const defaultElo = config.elo.default_rating;
	const [created] = await db
		.insert(ratings)
		.values({
			userId,
			kitId,
			seasonId,
			elo: defaultElo,
			peakElo: defaultElo,
		})
		.returning();

	return created;
}

export async function voidMatch(matchId: string) {
	const match = await db.query.matches.findFirst({
		where: eq(matches.id, matchId),
	});
	if (!match) throw new ApiError(404, "NOT_FOUND", "Match not found");

	await db.transaction(async (tx) => {
		if (match.status === "completed" && match.winnerId && match.loserId) {
			if (match.winnerEloDelta) {
				await tx
					.update(ratings)
					.set({
						elo: match.winnerEloBefore!,
						wins: sql`${ratings.wins} - 1`,
						gamesPlayed: sql`${ratings.gamesPlayed} - 1`,
						rank: sql`CASE WHEN ${ratings.placementDone} THEN NULL ELSE 'Unranked' END`,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(ratings.userId, match.winnerId),
							eq(ratings.kitId, match.kitId),
							eq(ratings.seasonId, match.seasonId),
						),
					);
			}
			if (match.loserEloDelta) {
				await tx
					.update(ratings)
					.set({
						elo: match.loserEloBefore!,
						losses: sql`${ratings.losses} - 1`,
						gamesPlayed: sql`${ratings.gamesPlayed} - 1`,
						rank: sql`CASE WHEN ${ratings.placementDone} THEN NULL ELSE 'Unranked' END`,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(ratings.userId, match.loserId),
							eq(ratings.kitId, match.kitId),
							eq(ratings.seasonId, match.seasonId),
						),
					);
			}
		}

		await tx
			.update(matches)
			.set({ status: "void" })
			.where(eq(matches.id, matchId));
	});

	return { success: true };
}

export async function issuePunishment(input: {
	minecraft_uuid: string;
	type: string;
	reason: string;
	evidence_ref?: string;
	issued_by: string;
	expires_at?: string;
}) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, input.minecraft_uuid),
	});
	if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

	const [punishment] = await db
		.insert(punishments)
		.values({
			userId: user.id,
			type: input.type,
			reason: input.reason,
			evidenceRef: input.evidence_ref,
			issuedBy: input.issued_by,
			expiresAt: input.expires_at ? new Date(input.expires_at) : null,
		})
		.returning();

	if (input.type === "ban") {
		await db
			.update(users)
			.set({ refreshToken: null, updatedAt: new Date() })
			.where(eq(users.id, user.id));
	}

	return punishment;
}

export async function revokePunishment(id: number) {
	await db
		.update(punishments)
		.set({ revoked: true })
		.where(eq(punishments.id, id));
	return { success: true };
}

export async function checkSessionValid(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return { valid: false };
	return { valid: user.refreshToken !== null };
}

export async function getActivePunishments(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return [];

	const now = new Date();
	return db.query.punishments.findMany({
		where: and(
			eq(punishments.userId, user.id),
			eq(punishments.revoked, false),
			or(isNull(punishments.expiresAt), gt(punishments.expiresAt, now)),
		),
	});
}

export async function getActiveLoadout(minecraftUuid: string, kitSlug: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");

	if (!kit.allowCustomLoadouts) {
		return { inventory: kit.defaultInventory, source: "kit_default" };
	}

	const loadout = await db.query.playerLoadouts.findFirst({
		where: and(
			eq(playerLoadouts.userId, user.id),
			eq(playerLoadouts.kitId, kit.id),
			eq(playerLoadouts.isDefault, true),
		),
	});

	if (loadout) {
		return { inventory: loadout.inventory, source: "player_loadout" };
	}

	return { inventory: kit.defaultInventory, source: "kit_default" };
}
