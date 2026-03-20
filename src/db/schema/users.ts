import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	minecraftUuid: varchar("minecraft_uuid", { length: 36 }).unique().notNull(),
	username: varchar("username", { length: 16 }).notNull(),
	microsoftId: varchar("microsoft_id", { length: 255 }),
	refreshToken: varchar("refresh_token", { length: 255 }),
	versionPreference: varchar("version_preference", { length: 32 }).default(
		"1.8",
	),
	language: varchar("language", { length: 8 }).default("en"),
	preferences: jsonb("preferences").default({}),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at"),
});
