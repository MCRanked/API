import { Elysia } from "elysia";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "./error";

export const authGuard = new Elysia({ name: "auth-guard" }).derive(
	async ({ headers }) => {
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
			const payload = await verifyAccessToken(token);
			return { user: payload };
		} catch {
			throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
		}
	},
).as("plugin");
