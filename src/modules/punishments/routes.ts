import { Elysia, t } from "elysia";
import { ApiError } from "../../middleware/error";
import { getPublicPunishments } from "./service";

export const punishmentsRoutes = new Elysia({ prefix: "/punishments" }).get(
	"/:uuid",
	async ({ params }) => {
		const result = await getPublicPunishments(params.uuid);
		if (result === null) throw new ApiError(404, "NOT_FOUND", "User not found");
		return result;
	},
	{ params: t.Object({ uuid: t.String() }) },
);
