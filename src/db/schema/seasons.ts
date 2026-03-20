import {
	boolean,
	integer,
	jsonb,
	pgTable,
	serial,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { kits } from "./kits";

export const seasons = pgTable(
	"seasons",
	{
		id: serial("id").primaryKey(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		number: integer("number").notNull(),
		startsAt: timestamp("starts_at").notNull(),
		endsAt: timestamp("ends_at"),
		active: boolean("active").default(false),
		config: jsonb("config").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.kitId, table.number)],
);
