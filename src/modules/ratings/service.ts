import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { kits, ratings, seasons, users } from "../../db/schema";
import {
	decodeCursor,
	encodeCursor,
	paginatedResponse,
} from "../../lib/pagination";

export async function getLeaderboard(
	kitSlug: string,
	cursor: string | null,
	limit: number,
) {
	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) return null;

	const activeSeason = await db.query.seasons.findFirst({
		where: and(eq(seasons.kitId, kit.id), eq(seasons.active, true)),
	});
	if (!activeSeason) return { data: [], next_cursor: null, has_more: false };

	const conditions: SQL[] = [
		eq(ratings.kitId, kit.id),
		eq(ratings.seasonId, activeSeason.id),
		eq(ratings.placementDone, true),
	];

	if (cursor) {
		const decoded = decodeCursor(cursor);
		if (decoded?.elo !== undefined && decoded?.id !== undefined) {
			conditions.push(
				or(
					lt(ratings.elo, decoded.elo as number),
					and(
						eq(ratings.elo, decoded.elo as number),
						lt(ratings.id, decoded.id as number),
					),
				) as SQL,
			);
		}
	}

	const results = await db.query.ratings.findMany({
		where: and(...conditions),
		orderBy: [desc(ratings.elo), desc(ratings.id)],
		limit: limit + 1,
	});

	return paginatedResponse(results, limit, (last) =>
		encodeCursor({ id: last.id, elo: last.elo }),
	);
}

export async function getUserRating(minecraftUuid: string, kitSlug: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) return null;

	const activeSeason = await db.query.seasons.findFirst({
		where: and(eq(seasons.kitId, kit.id), eq(seasons.active, true)),
	});
	if (!activeSeason) return null;

	return db.query.ratings.findFirst({
		where: and(
			eq(ratings.userId, user.id),
			eq(ratings.kitId, kit.id),
			eq(ratings.seasonId, activeSeason.id),
		),
	});
}
