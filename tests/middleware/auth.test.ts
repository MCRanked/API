import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { authGuard } from "../../src/middleware/auth";
import { errorHandler } from "../../src/middleware/error";
import { signAccessToken } from "../../src/lib/jwt";

describe("authGuard", () => {
	const app = new Elysia()
		.use(errorHandler)
		.use(authGuard)
		.get("/protected", ({ store }) => ({ uuid: store.user.sub }));

	test("rejects requests without Authorization header", async () => {
		const res = await app.handle(new Request("http://localhost/protected"));
		expect(res.status).toBe(401);
	});

	test("rejects invalid tokens", async () => {
		const res = await app.handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: "Bearer invalid-token" },
			}),
		);
		expect(res.status).toBe(401);
	});

	test("allows valid tokens and populates user context", async () => {
		const token = await signAccessToken({
			sub: "user-123",
			minecraft_uuid: "mc-456",
			username: "TestPlayer",
		});
		const res = await app.handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.uuid).toBe("user-123");
	});
});
