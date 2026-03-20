import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { users, ratings, playerLoadouts, kits } from "../../db/schema";
import { ApiError } from "../../middleware/error";

export async function getUserByUuid(minecraftUuid: string) {
	return db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
		columns: {
			id: true,
			minecraftUuid: true,
			username: true,
			versionPreference: true,
			language: true,
			preferences: true,
			createdAt: true,
			lastSeenAt: true,
		},
	});
}

export async function getUserById(userId: string) {
	return db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: {
			id: true,
			minecraftUuid: true,
			username: true,
			versionPreference: true,
			language: true,
			preferences: true,
			createdAt: true,
			lastSeenAt: true,
		},
	});
}

export async function updatePreferences(
	userId: string,
	prefs: { language?: string; version_preference?: string; preferences?: Record<string, unknown> },
) {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (prefs.language !== undefined) updates.language = prefs.language;
	if (prefs.version_preference !== undefined) updates.versionPreference = prefs.version_preference;
	if (prefs.preferences !== undefined) updates.preferences = prefs.preferences;

	await db.update(users).set(updates).where(eq(users.id, userId));
}

export async function getUserRatings(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	return db.query.ratings.findMany({
		where: eq(ratings.userId, user.id),
	});
}

export async function getLoadouts(userId: string, kitSlug?: string) {
	if (kitSlug) {
		const kit = await db.query.kits.findFirst({
			where: eq(kits.slug, kitSlug),
		});
		if (!kit) return [];
		return db.query.playerLoadouts.findMany({
			where: and(
				eq(playerLoadouts.userId, userId),
				eq(playerLoadouts.kitId, kit.id),
			),
		});
	}
	return db.query.playerLoadouts.findMany({
		where: eq(playerLoadouts.userId, userId),
	});
}

export async function saveLoadout(
	userId: string,
	kitSlug: string,
	name: string,
	inventory: unknown,
) {
	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");

	if (!kit.allowCustomLoadouts) {
		throw new ApiError(
			400,
			"VALIDATION_ERROR",
			"This kit does not allow custom loadouts",
		);
	}

	// TODO: Validate inventory against kit.ruleset.inventory_rules
	// For MVP, accept any valid JSON and add validation in a follow-up.

	const existing = await db.query.playerLoadouts.findFirst({
		where: and(
			eq(playerLoadouts.userId, userId),
			eq(playerLoadouts.kitId, kit.id),
			eq(playerLoadouts.name, name),
		),
	});

	if (existing) {
		await db
			.update(playerLoadouts)
			.set({ inventory, updatedAt: new Date() })
			.where(eq(playerLoadouts.id, existing.id));
		return { ...existing, inventory, updatedAt: new Date() };
	}

	const [created] = await db
		.insert(playerLoadouts)
		.values({
			userId,
			kitId: kit.id,
			name,
			inventory,
		})
		.returning();
	return created;
}

export async function deleteLoadout(
	userId: string,
	kitSlug: string,
	name: string,
) {
	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");

	await db
		.delete(playerLoadouts)
		.where(
			and(
				eq(playerLoadouts.userId, userId),
				eq(playerLoadouts.kitId, kit.id),
				eq(playerLoadouts.name, name),
			),
		);
}
