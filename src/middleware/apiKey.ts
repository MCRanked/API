import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { config } from "../config";
import { ApiError } from "./error";

function safeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const apiKeyGuard = new Elysia({ name: "api-key-guard" })
	.derive(({ headers }) => {
		const apiKey = headers["x-api-key"];
		if (!apiKey || !safeCompare(apiKey, config.internalApiKey)) {
			throw new ApiError(401, "UNAUTHORIZED", "Invalid or missing API key");
		}
		return {};
	})
	.as("scoped");
