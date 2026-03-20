import { beforeEach, describe, expect, mock, test } from "bun:test";

const getPublicPunishments = mock(() =>
	Promise.resolve([
		{
			id: 1,
			type: "ban",
			reason: "Cheating",
			expiresAt: "2026-06-01T00:00:00.000Z",
			revoked: false,
			createdAt: "2026-01-01T00:00:00.000Z",
		},
		{
			id: 2,
			type: "mute",
			reason: "Toxic behavior",
			expiresAt: null,
			revoked: true,
			createdAt: "2025-12-01T00:00:00.000Z",
		},
	]),
);

mock.module("../../src/modules/punishments/service", () => ({
	getPublicPunishments,
}));

import { Elysia } from "elysia";
import { errorHandler } from "../../src/middleware/error";
import { punishmentsRoutes } from "../../src/modules/punishments/routes";

const app = new Elysia().use(errorHandler).use(punishmentsRoutes);

beforeEach(() => {
	getPublicPunishments.mockClear();
});

describe("GET /punishments/:uuid", () => {
	test("returns punishment history", async () => {
		const res = await app.handle(
			new Request("http://localhost/punishments/player-uuid-123"),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(2);
		expect(body[0].type).toBe("ban");
		expect(body[0].reason).toBe("Cheating");
		expect(body[1].type).toBe("mute");
		expect(body[1].revoked).toBe(true);
		expect(getPublicPunishments).toHaveBeenCalledTimes(1);
	});

	test("returns 404 when user not found", async () => {
		getPublicPunishments.mockImplementationOnce((() =>
			Promise.resolve(null)) as never);
		const res = await app.handle(
			new Request("http://localhost/punishments/unknown-uuid"),
		);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("NOT_FOUND");
		expect(body.error).toBe("User not found");
	});
});
