import {
	pgTable,
	serial,
	varchar,
	text,
	jsonb,
	boolean,
	integer,
	timestamp,
} from "drizzle-orm/pg-core";

export const kits = pgTable("kits", {
	id: serial("id").primaryKey(),
	slug: varchar("slug", { length: 32 }).unique().notNull(),
	name: varchar("name", { length: 64 }).notNull(),
	description: text("description"),
	versionRange: varchar("version_range", { length: 32 }).notNull(),
	ruleset: jsonb("ruleset").notNull(),
	defaultInventory: jsonb("default_inventory"),
	allowCustomLoadouts: boolean("allow_custom_loadouts").default(false),
	icon: varchar("icon", { length: 255 }),
	category: varchar("category", { length: 32 }),
	displayOrder: integer("display_order").default(0),
	active: boolean("active").default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
