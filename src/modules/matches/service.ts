import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { matches, users } from "../../db/schema";
import {
	decodeCursor,
	encodeCursor,
	paginatedResponse,
} from "../../lib/pagination";

export async function getMatchById(id: string) {
	return db.query.matches.findFirst({
		where: eq(matches.id, id),
	});
}

export async function getRecentMatches(limit: number, cursor: string | null) {
	const conditions = [eq(matches.status, "completed")];

	if (cursor) {
		const decoded = decodeCursor(cursor);
		if (decoded?.played_at) {
			conditions.push(
				lt(matches.playedAt, new Date(decoded.played_at as string)),
			);
		}
	}

	const results = await db.query.matches.findMany({
		where: and(...conditions),
		orderBy: desc(matches.playedAt),
		limit: limit + 1,
	});

	return paginatedResponse(results, limit, (last) =>
		encodeCursor({ played_at: last.playedAt.toISOString(), id: last.id }),
	);
}

export async function getUserMatches(
	minecraftUuid: string,
	limit: number,
	cursor: string | null,
) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	const conditions: SQL[] = [
		or(eq(matches.winnerId, user.id), eq(matches.loserId, user.id)) as SQL,
	];

	if (cursor) {
		const decoded = decodeCursor(cursor);
		if (decoded?.played_at) {
			conditions.push(
				lt(matches.playedAt, new Date(decoded.played_at as string)),
			);
		}
	}

	const results = await db.query.matches.findMany({
		where: and(...conditions),
		orderBy: desc(matches.playedAt),
		limit: limit + 1,
	});

	return paginatedResponse(results, limit, (last) =>
		encodeCursor({ played_at: last.playedAt.toISOString(), id: last.id }),
	);
}
