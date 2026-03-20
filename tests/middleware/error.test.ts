import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler, ApiError } from "../../src/middleware/error";

describe("errorHandler", () => {
	const app = new Elysia()
		.use(errorHandler)
		.get("/ok", () => ({ data: "hello" }))
		.get("/api-error", () => {
			throw new ApiError(400, "VALIDATION_ERROR", "Invalid input", {
				field: "name",
			});
		})
		.get("/unknown-error", () => {
			throw new Error("something broke");
		});

	test("passes through successful responses", async () => {
		const res = await app.handle(new Request("http://localhost/ok"));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: "hello" });
	});

	test("formats ApiError correctly", async () => {
		const res = await app.handle(new Request("http://localhost/api-error"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({
			error: "Invalid input",
			code: "VALIDATION_ERROR",
			details: { field: "name" },
		});
	});

	test("formats unknown errors as 500", async () => {
		const res = await app.handle(
			new Request("http://localhost/unknown-error"),
		);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.code).toBe("INTERNAL_ERROR");
	});
});
