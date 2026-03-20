import { Elysia } from "elysia";
import { config } from "../config";
import { ApiError } from "./error";

export const apiKeyGuard = new Elysia({ name: "api-key-guard" })
	.derive(({ headers }) => {
		const apiKey = headers["x-api-key"];
		if (!apiKey || apiKey !== config.internalApiKey) {
			throw new ApiError(401, "UNAUTHORIZED", "Invalid or missing API key");
		}
		return {};
	})
	.as("scoped");
