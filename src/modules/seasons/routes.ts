import { Elysia, t } from "elysia";
import { ApiError } from "../../middleware/error";
import { getActiveSeasons, getSeasonById, listSeasons } from "./service";

export const seasonsRoutes = new Elysia({ prefix: "/seasons" })
	.get("/", () => listSeasons())
	.get("/active", () => getActiveSeasons())
	.get(
		"/:id",
		async ({ params }) => {
			const season = await getSeasonById(Number(params.id));
			if (!season) throw new ApiError(404, "NOT_FOUND", "Season not found");
			return season;
		},
		{ params: t.Object({ id: t.String() }) },
	);
