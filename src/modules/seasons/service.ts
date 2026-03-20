import { eq } from "drizzle-orm";
import { db } from "../../db";
import { seasons } from "../../db/schema";

export async function listSeasons() {
	return db.query.seasons.findMany({
		orderBy: seasons.createdAt,
	});
}

export async function getActiveSeasons() {
	return db.query.seasons.findMany({
		where: eq(seasons.active, true),
	});
}

export async function getSeasonById(id: number) {
	return db.query.seasons.findFirst({
		where: eq(seasons.id, id),
	});
}
