import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { apiKeyGuard } from "../../src/middleware/apiKey";
import { errorHandler } from "../../src/middleware/error";

describe("apiKeyGuard", () => {
	const app = new Elysia()
		.use(errorHandler)
		.use(apiKeyGuard)
		.get("/internal", () => ({ ok: true }));

	test("rejects requests without X-API-Key header", async () => {
		const res = await app.handle(new Request("http://localhost/internal"));
		expect(res.status).toBe(401);
	});

	test("rejects wrong API key", async () => {
		const res = await app.handle(
			new Request("http://localhost/internal", {
				headers: { "X-API-Key": "wrong-key" },
			}),
		);
		expect(res.status).toBe(401);
	});

	test("allows correct API key", async () => {
		const res = await app.handle(
			new Request("http://localhost/internal", {
				headers: { "X-API-Key": "test-api-key" },
			}),
		);
		expect(res.status).toBe(200);
	});
});
