import { eq } from "drizzle-orm";
import { db } from "../../db";
import { punishments, users } from "../../db/schema";

export async function getPublicPunishments(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	return db.query.punishments.findMany({
		where: eq(punishments.userId, user.id),
		columns: {
			id: true,
			type: true,
			reason: true,
			expiresAt: true,
			revoked: true,
			createdAt: true,
		},
	});
}
