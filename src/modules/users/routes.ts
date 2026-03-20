import { Elysia, t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
	getUserByUuid,
	getUserById,
	updatePreferences,
	getUserRatings,
	getLoadouts,
	saveLoadout,
	deleteLoadout,
} from "./service";
import { ApiError } from "../../middleware/error";
import { getUserMatches } from "../matches/service";

export const usersRoutes = new Elysia({ prefix: "/users" })
	// Public routes
	.get(
		"/:uuid",
		async ({ params }) => {
			const user = await getUserByUuid(params.uuid);
			if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
			return user;
		},
		{ params: t.Object({ uuid: t.String() }) },
	)
	.get(
		"/:uuid/ratings",
		async ({ params }) => {
			const result = await getUserRatings(params.uuid);
			if (result === null) throw new ApiError(404, "NOT_FOUND", "User not found");
			return result;
		},
		{ params: t.Object({ uuid: t.String() }) },
	)
	.get(
		"/:uuid/matches",
		async ({ params, query }) => {
			const limit = Math.min(Number(query.limit) || 20, 100);
			const result = await getUserMatches(params.uuid, limit, query.cursor ?? null);
			if (result === null) throw new ApiError(404, "NOT_FOUND", "User not found");
			return result;
		},
		{
			params: t.Object({ uuid: t.String() }),
			query: t.Object({
				cursor: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	// Authenticated routes
	.use(authGuard)
	.get("/me", async ({ user }) => {
		const profile = await getUserById(user.sub);
		if (!profile) throw new ApiError(404, "NOT_FOUND", "User not found");
		return profile;
	})
	.patch(
		"/me/preferences",
		async ({ user, body }) => {
			await updatePreferences(user.sub, body);
			return { success: true };
		},
		{
			body: t.Object({
				language: t.Optional(t.String()),
				version_preference: t.Optional(t.String()),
				preferences: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	)
	.get("/me/loadouts", async ({ user }) => {
		return getLoadouts(user.sub);
	})
	.get(
		"/me/loadouts/:kitSlug",
		async ({ user, params }) => {
			return getLoadouts(user.sub, params.kitSlug);
		},
		{ params: t.Object({ kitSlug: t.String() }) },
	)
	.put(
		"/me/loadouts/:kitSlug/:name",
		async ({ user, params, body }) => {
			return saveLoadout(user.sub, params.kitSlug, params.name, body.inventory);
		},
		{
			params: t.Object({ kitSlug: t.String(), name: t.String() }),
			body: t.Object({ inventory: t.Unknown() }),
		},
	)
	.delete(
		"/me/loadouts/:kitSlug/:name",
		async ({ user, params }) => {
			await deleteLoadout(user.sub, params.kitSlug, params.name);
			return { success: true };
		},
		{
			params: t.Object({ kitSlug: t.String(), name: t.String() }),
		},
	);
