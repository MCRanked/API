import { eq } from "drizzle-orm";
import { db } from "../../db";
import { kits } from "../../db/schema";

export async function listActiveKits() {
	return db.query.kits.findMany({
		where: eq(kits.active, true),
		orderBy: kits.displayOrder,
	});
}

export async function getKitBySlug(slug: string) {
	return db.query.kits.findFirst({
		where: eq(kits.slug, slug),
	});
}
