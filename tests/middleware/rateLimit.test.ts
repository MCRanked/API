import { describe, expect, test, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { rateLimiter } from "../../src/middleware/rateLimit";

describe("rateLimiter", () => {
	test("allows requests under the limit", async () => {
		const app = new Elysia()
			.use(rateLimiter({ max: 5, windowMs: 60000 }))
			.get("/test", () => "ok");

		const res = await app.handle(new Request("http://localhost/test"));
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
	});

	test("blocks requests over the limit", async () => {
		const app = new Elysia()
			.use(rateLimiter({ max: 2, windowMs: 60000 }))
			.get("/test", () => "ok");

		const req = () => app.handle(new Request("http://localhost/test"));
		await req(); // 1
		await req(); // 2
		const res = await req(); // 3 — should be blocked
		expect(res.status).toBe(429);
	});
});
