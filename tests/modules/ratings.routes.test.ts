import { beforeEach, describe, expect, mock, test } from "bun:test";

const getLeaderboard = mock(() =>
	Promise.resolve({
		data: [
			{ id: 1, elo: 1800, userId: 10 },
			{ id: 2, elo: 1750, userId: 20 },
		],
		next_cursor: "abc123",
		has_more: true,
	}),
);
const getUserRating = mock(() =>
	Promise.resolve({ id: 1, elo: 1500, kitId: 1, seasonId: 1, gamesPlayed: 25 }),
);

mock.module("../../src/modules/ratings/service", () => ({
	getLeaderboard,
	getUserRating,
}));

import { Elysia } from "elysia";
import { errorHandler } from "../../src/middleware/error";
import { ratingsRoutes } from "../../src/modules/ratings/routes";

const app = new Elysia().use(errorHandler).use(ratingsRoutes);

beforeEach(() => {
	getLeaderboard.mockClear();
	getUserRating.mockClear();
});

describe("GET /ratings/leaderboard/:kitSlug", () => {
	test("returns leaderboard data", async () => {
		const res = await app.handle(
			new Request("http://localhost/ratings/leaderboard/sword"),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(2);
		expect(body.has_more).toBe(true);
		expect(body.next_cursor).toBe("abc123");
		expect(getLeaderboard).toHaveBeenCalledTimes(1);
	});

	test("returns 404 when kit not found", async () => {
		getLeaderboard.mockImplementationOnce((() =>
			Promise.resolve(null)) as never);
		const res = await app.handle(
			new Request("http://localhost/ratings/leaderboard/nonexistent"),
		);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("NOT_FOUND");
		expect(body.error).toBe("Kit not found");
	});

	test("passes limit and cursor params correctly", async () => {
		const res = await app.handle(
			new Request(
				"http://localhost/ratings/leaderboard/sword?limit=50&cursor=xyz",
			),
		);
		expect(res.status).toBe(200);
		expect(getLeaderboard).toHaveBeenCalledWith("sword", "xyz", 50);
	});

	test("defaults limit to 20 when not provided", async () => {
		const res = await app.handle(
			new Request("http://localhost/ratings/leaderboard/sword"),
		);
		expect(res.status).toBe(200);
		expect(getLeaderboard).toHaveBeenCalledWith("sword", null, 20);
	});

	test("caps limit at 100", async () => {
		const res = await app.handle(
			new Request("http://localhost/ratings/leaderboard/sword?limit=500"),
		);
		expect(res.status).toBe(200);
		expect(getLeaderboard).toHaveBeenCalledWith("sword", null, 100);
	});
});

describe("GET /ratings/:uuid/:kitSlug", () => {
	test("returns rating when found", async () => {
		const res = await app.handle(
			new Request("http://localhost/ratings/player-uuid-123/sword"),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.elo).toBe(1500);
		expect(body.gamesPlayed).toBe(25);
		expect(getUserRating).toHaveBeenCalledTimes(1);
	});

	test("returns 404 when rating not found", async () => {
		getUserRating.mockImplementationOnce((() =>
			Promise.resolve(null)) as never);
		const res = await app.handle(
			new Request("http://localhost/ratings/unknown-uuid/sword"),
		);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("NOT_FOUND");
		expect(body.error).toBe("Rating not found");
	});
});
