import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../../db";
import { kits, seasons } from "../../db/schema";
import { apiKeyGuard } from "../../middleware/apiKey";
import {
	checkSessionValid,
	getActiveLoadout,
	getActivePunishments,
	issuePunishment,
	revokePunishment,
	submitMatch,
	voidMatch,
} from "./service";

export const internalRoutes = new Elysia({ prefix: "/internal/v1" })
	.use(apiKeyGuard)
	.post("/matches", async ({ body }) => submitMatch(body), {
		body: t.Object({
			kit_id: t.Number(),
			winner_minecraft_uuid: t.String(),
			loser_minecraft_uuid: t.String(),
			region: t.String(),
			node_id: t.String(),
			duration_ms: t.Number(),
			decisiveness_score: t.Number({ minimum: 0, maximum: 1 }),
			integrity_score: t.Number({ minimum: 0, maximum: 1 }),
			metadata: t.Optional(t.Record(t.String(), t.Unknown())),
		}),
	})
	.post("/matches/:id/void", async ({ params }) => voidMatch(params.id), {
		params: t.Object({ id: t.String() }),
	})
	.post("/punishments", async ({ body }) => issuePunishment(body), {
		body: t.Object({
			minecraft_uuid: t.String(),
			type: t.String(),
			reason: t.String(),
			evidence_ref: t.Optional(t.String()),
			issued_by: t.String(),
			expires_at: t.Optional(t.String()),
		}),
	})
	.delete(
		"/punishments/:id",
		async ({ params }) => revokePunishment(Number(params.id)),
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/users/:uuid/session-valid",
		async ({ params }) => checkSessionValid(params.uuid),
		{ params: t.Object({ uuid: t.String() }) },
	)
	.get(
		"/users/:uuid/active-punishments",
		async ({ params }) => getActivePunishments(params.uuid),
		{ params: t.Object({ uuid: t.String() }) },
	)
	.get(
		"/users/:uuid/loadout/:kitSlug",
		async ({ params }) => getActiveLoadout(params.uuid, params.kitSlug),
		{ params: t.Object({ uuid: t.String(), kitSlug: t.String() }) },
	)
	.post(
		"/seasons",
		async ({ body }) => {
			const [season] = await db
				.insert(seasons)
				.values({
					kitId: body.kit_id,
					number: body.number,
					startsAt: new Date(body.starts_at),
					endsAt: body.ends_at ? new Date(body.ends_at) : null,
					active: body.active ?? false,
					config: body.config,
				})
				.returning();
			return season;
		},
		{
			body: t.Object({
				kit_id: t.Number(),
				number: t.Number(),
				starts_at: t.String(),
				ends_at: t.Optional(t.String()),
				active: t.Optional(t.Boolean()),
				config: t.Unknown(),
			}),
		},
	)
	.patch(
		"/seasons/:id",
		async ({ params, body }) => {
			const updates: Record<string, unknown> = {};
			if (body.active !== undefined) updates.active = body.active;
			if (body.config !== undefined) updates.config = body.config;
			if (body.ends_at !== undefined) updates.endsAt = new Date(body.ends_at);

			await db
				.update(seasons)
				.set(updates)
				.where(eq(seasons.id, Number(params.id)));
			return { success: true };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				active: t.Optional(t.Boolean()),
				config: t.Optional(t.Unknown()),
				ends_at: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/kits",
		async ({ body }) => {
			const [kit] = await db
				.insert(kits)
				.values({
					slug: body.slug,
					name: body.name,
					description: body.description,
					versionRange: body.version_range,
					ruleset: body.ruleset,
					defaultInventory: body.default_inventory,
					allowCustomLoadouts: body.allow_custom_loadouts ?? false,
					icon: body.icon,
					category: body.category,
					displayOrder: body.display_order ?? 0,
				})
				.returning();
			return kit;
		},
		{
			body: t.Object({
				slug: t.String(),
				name: t.String(),
				description: t.Optional(t.String()),
				version_range: t.String(),
				ruleset: t.Unknown(),
				default_inventory: t.Optional(t.Unknown()),
				allow_custom_loadouts: t.Optional(t.Boolean()),
				icon: t.Optional(t.String()),
				category: t.Optional(t.String()),
				display_order: t.Optional(t.Number()),
			}),
		},
	)
	.patch(
		"/kits/:slug",
		async ({ params, body }) => {
			const updates: Record<string, unknown> = {
				updatedAt: new Date(),
			};
			if (body.name !== undefined) updates.name = body.name;
			if (body.ruleset !== undefined) updates.ruleset = body.ruleset;
			if (body.default_inventory !== undefined)
				updates.defaultInventory = body.default_inventory;
			if (body.active !== undefined) updates.active = body.active;
			if (body.allow_custom_loadouts !== undefined)
				updates.allowCustomLoadouts = body.allow_custom_loadouts;

			await db.update(kits).set(updates).where(eq(kits.slug, params.slug));
			return { success: true };
		},
		{
			params: t.Object({ slug: t.String() }),
			body: t.Object({
				name: t.Optional(t.String()),
				ruleset: t.Optional(t.Unknown()),
				default_inventory: t.Optional(t.Unknown()),
				active: t.Optional(t.Boolean()),
				allow_custom_loadouts: t.Optional(t.Boolean()),
			}),
		},
	);
