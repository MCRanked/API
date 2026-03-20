import { beforeEach, describe, expect, mock, test } from "bun:test";

const getMatchById = mock(() =>
	Promise.resolve({
		id: "match-001",
		winnerId: 1,
		loserId: 2,
		kitId: 1,
		status: "completed",
		playedAt: "2026-01-15T12:00:00.000Z",
	}),
);
const getRecentMatches = mock(() =>
	Promise.resolve({
		data: [
			{
				id: "match-001",
				status: "completed",
				playedAt: "2026-01-15T12:00:00.000Z",
			},
			{
				id: "match-002",
				status: "completed",
				playedAt: "2026-01-14T12:00:00.000Z",
			},
		],
		next_cursor: "cursor-abc",
		has_more: true,
	}),
);

mock.module("../../src/modules/matches/service", () => ({
	getMatchById,
	getRecentMatches,
}));

import { Elysia } from "elysia";
import { errorHandler } from "../../src/middleware/error";
import { matchesRoutes } from "../../src/modules/matches/routes";

const app = new Elysia().use(errorHandler).use(matchesRoutes);

beforeEach(() => {
	getMatchById.mockClear();
	getRecentMatches.mockClear();
});

describe("GET /matches/:id", () => {
	test("returns match when found", async () => {
		const res = await app.handle(
			new Request("http://localhost/matches/match-001"),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe("match-001");
		expect(body.status).toBe("completed");
		expect(getMatchById).toHaveBeenCalledTimes(1);
	});

	test("returns 404 when match not found", async () => {
		getMatchById.mockImplementationOnce((() => Promise.resolve(null)) as never);
		const res = await app.handle(
			new Request("http://localhost/matches/nonexistent"),
		);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("NOT_FOUND");
		expect(body.error).toBe("Match not found");
	});
});

describe("GET /matches/recent", () => {
	test("returns paginated results", async () => {
		const res = await app.handle(
			new Request("http://localhost/matches/recent"),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.data).toHaveLength(2);
		expect(body.has_more).toBe(true);
		expect(body.next_cursor).toBe("cursor-abc");
		expect(getRecentMatches).toHaveBeenCalledTimes(1);
	});

	test("passes limit and cursor params correctly", async () => {
		const res = await app.handle(
			new Request(
				"http://localhost/matches/recent?limit=10&cursor=prev-cursor",
			),
		);
		expect(res.status).toBe(200);
		expect(getRecentMatches).toHaveBeenCalledWith(10, "prev-cursor");
	});

	test("defaults limit to 20 when not provided", async () => {
		const res = await app.handle(
			new Request("http://localhost/matches/recent"),
		);
		expect(res.status).toBe(200);
		expect(getRecentMatches).toHaveBeenCalledWith(20, null);
	});

	test("caps limit at 100", async () => {
		const res = await app.handle(
			new Request("http://localhost/matches/recent?limit=999"),
		);
		expect(res.status).toBe(200);
		expect(getRecentMatches).toHaveBeenCalledWith(100, null);
	});
});
