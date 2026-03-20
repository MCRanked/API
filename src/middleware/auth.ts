import { Elysia } from "elysia";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "./error";

export const authGuard = new Elysia({ name: "auth-guard" }).onBeforeHandle(
	async ({ headers, store }) => {
		const authorization = headers.authorization;
		if (!authorization?.startsWith("Bearer ")) {
			throw new ApiError(
				401,
				"UNAUTHORIZED",
				"Missing or invalid Authorization header",
			);
		}

		const token = authorization.slice(7);
		try {
			store.user = await verifyAccessToken(token);
		} catch {
			throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
		}
	},
).as("plugin");
