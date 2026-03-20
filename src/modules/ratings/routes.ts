import { Elysia, t } from "elysia";
import { getLeaderboard, getUserRating } from "./service";
import { ApiError } from "../../middleware/error";

export const ratingsRoutes = new Elysia({ prefix: "/ratings" })
	.get(
		"/leaderboard/:kitSlug",
		async ({ params, query }) => {
			const limit = Math.min(Number(query.limit) || 20, 100);
			const result = await getLeaderboard(
				params.kitSlug,
				query.cursor ?? null,
				limit,
			);
			if (result === null)
				throw new ApiError(404, "NOT_FOUND", "Kit not found");
			return result;
		},
		{
			params: t.Object({ kitSlug: t.String() }),
			query: t.Object({
				cursor: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/:uuid/:kitSlug",
		async ({ params }) => {
			const rating = await getUserRating(params.uuid, params.kitSlug);
			if (!rating)
				throw new ApiError(404, "NOT_FOUND", "Rating not found");
			return rating;
		},
		{
			params: t.Object({ uuid: t.String(), kitSlug: t.String() }),
		},
	);
