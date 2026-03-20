import { Elysia } from "elysia";

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public details?: Record<string, unknown>,
	) {
		super(message);
	}
}

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
	({ error, set }) => {
		if (error instanceof ApiError) {
			set.status = error.status;
			return {
				error: error.message,
				code: error.code,
				details: error.details ?? {},
			};
		}

		console.error("Unhandled error:", error);
		set.status = 500;
		return {
			error: "Internal server error",
			code: "INTERNAL_ERROR",
			details: {},
		};
	},
).as("plugin");
