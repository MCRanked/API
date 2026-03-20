import { Elysia, t } from "elysia";
import { ApiError } from "../../middleware/error";
import { getKitBySlug, listActiveKits } from "./service";

export const kitsRoutes = new Elysia({ prefix: "/kits" })
	.get("/", () => listActiveKits())
	.get(
		"/:slug",
		async ({ params }) => {
			const kit = await getKitBySlug(params.slug);
			if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");
			return kit;
		},
		{ params: t.Object({ slug: t.String() }) },
	);
