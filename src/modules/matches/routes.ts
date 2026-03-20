import { Elysia, t } from "elysia";
import { getMatchById, getRecentMatches } from "./service";
import { ApiError } from "../../middleware/error";

export const matchesRoutes = new Elysia({ prefix: "/matches" })
	.get(
		"/:id",
		async ({ params }) => {
			const match = await getMatchById(params.id);
			if (!match)
				throw new ApiError(404, "NOT_FOUND", "Match not found");
			return match;
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/recent",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit) || 20, 100);
			return getRecentMatches(limit, query.cursor ?? null);
		},
		{
			query: t.Object({
				cursor: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	);
