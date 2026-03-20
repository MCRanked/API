import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { kits } from "./kits";
import { users } from "./users";

export const playerLoadouts = pgTable(
	"player_loadouts",
	{
		id: serial("id").primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		name: varchar("name", { length: 32 }).default("default").notNull(),
		inventory: jsonb("inventory").notNull(),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique().on(table.userId, table.kitId, table.name),
		index("loadouts_user_kit_idx").on(table.userId, table.kitId),
	],
);
