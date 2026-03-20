import {
	boolean,
	index,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const punishments = pgTable(
	"punishments",
	{
		id: serial("id").primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		type: varchar("type", { length: 16 }).notNull(),
		reason: text("reason").notNull(),
		evidenceRef: varchar("evidence_ref", { length: 255 }),
		issuedBy: varchar("issued_by", { length: 64 }).notNull(),
		expiresAt: timestamp("expires_at"),
		revoked: boolean("revoked").default(false).notNull(),
		revokedReason: text("revoked_reason"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [index("punishments_user_idx").on(table.userId, table.revoked)],
);
