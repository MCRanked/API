import { eq } from "drizzle-orm";
import { config } from "../../config";
import { db } from "../../db";
import { users } from "../../db/schema";
import {
	generateRefreshToken,
	hashRefreshToken,
	signAccessToken,
} from "../../lib/jwt";
import type { MinecraftProfile } from "../../lib/microsoft-auth";
import { ApiError } from "../../middleware/error";

function formatUuid(raw: string): string {
	// Minecraft UUIDs come without dashes, normalize to dashed format
	if (raw.includes("-")) return raw;
	return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

interface AuthResult {
	accessToken: string;
	refreshToken: string;
	user: { id: string; minecraftUuid: string; username: string };
}

export async function authenticateMinecraftProfile(
	profile: MinecraftProfile,
	microsoftId?: string,
): Promise<AuthResult> {
	const minecraftUuid = formatUuid(profile.id);

	// Upsert user
	const existing = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});

	const refreshToken = generateRefreshToken();
	const hashedRefresh = await hashRefreshToken(refreshToken);
	const now = new Date();

	let userId: string;

	if (existing) {
		await db
			.update(users)
			.set({
				username: profile.name,
				refreshToken: hashedRefresh,
				microsoftId: microsoftId ?? existing.microsoftId,
				lastSeenAt: now,
				updatedAt: now,
			})
			.where(eq(users.id, existing.id));
		userId = existing.id;
	} else {
		const [newUser] = await db
			.insert(users)
			.values({
				minecraftUuid,
				username: profile.name,
				microsoftId: microsoftId ?? null,
				refreshToken: hashedRefresh,
				lastSeenAt: now,
			})
			.returning({ id: users.id });
		userId = newUser.id;
	}

	const accessToken = await signAccessToken({
		sub: userId,
		minecraft_uuid: minecraftUuid,
		username: profile.name,
	});

	return {
		accessToken,
		refreshToken,
		user: { id: userId, minecraftUuid, username: profile.name },
	};
}

export async function refreshSession(
	rawRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
	const hashedToken = await hashRefreshToken(rawRefreshToken);

	const user = await db.query.users.findFirst({
		where: eq(users.refreshToken, hashedToken),
	});

	if (!user) {
		throw new ApiError(401, "UNAUTHORIZED", "Invalid refresh token");
	}

	// Check if refresh token has expired (30 days from last update)
	const expiryMs = config.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000;
	if (user.updatedAt.getTime() + expiryMs < Date.now()) {
		// Token expired — clear it and reject
		await db
			.update(users)
			.set({ refreshToken: null })
			.where(eq(users.id, user.id));
		throw new ApiError(401, "UNAUTHORIZED", "Refresh token expired");
	}

	const newRefreshToken = generateRefreshToken();
	const newHashedRefresh = await hashRefreshToken(newRefreshToken);

	await db
		.update(users)
		.set({
			refreshToken: newHashedRefresh,
			lastSeenAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(users.id, user.id));

	const accessToken = await signAccessToken({
		sub: user.id,
		minecraft_uuid: user.minecraftUuid,
		username: user.username,
	});

	return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string): Promise<void> {
	await db
		.update(users)
		.set({ refreshToken: null, updatedAt: new Date() })
		.where(eq(users.id, userId));
}
