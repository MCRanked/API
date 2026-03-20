import { beforeEach, describe, expect, mock, test } from "bun:test";

const listSeasons = mock(() =>
	Promise.resolve([
		{ id: 1, name: "Season 1", active: false },
		{ id: 2, name: "Season 2", active: true },
	]),
);
const getActiveSeasons = mock(() =>
	Promise.resolve([{ id: 2, name: "Season 2", active: true }]),
);
const getSeasonById = mock(() =>
	Promise.resolve({ id: 1, name: "Season 1", active: false }),
);

mock.module("../../src/modules/seasons/service", () => ({
	listSeasons,
	getActiveSeasons,
	getSeasonById,
}));

import { Elysia } from "elysia";
import { errorHandler } from "../../src/middleware/error";
import { seasonsRoutes } from "../../src/modules/seasons/routes";

const app = new Elysia().use(errorHandler).use(seasonsRoutes);

beforeEach(() => {
	listSeasons.mockClear();
	getActiveSeasons.mockClear();
	getSeasonById.mockClear();
});

describe("GET /seasons", () => {
	test("returns list of seasons", async () => {
		const res = await app.handle(new Request("http://localhost/seasons"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(2);
		expect(body[0].name).toBe("Season 1");
		expect(body[1].name).toBe("Season 2");
		expect(listSeasons).toHaveBeenCalledTimes(1);
	});
});

describe("GET /seasons/active", () => {
	test("returns active seasons", async () => {
		const res = await app.handle(
			new Request("http://localhost/seasons/active"),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(1);
		expect(body[0].active).toBe(true);
		expect(getActiveSeasons).toHaveBeenCalledTimes(1);
	});
});

describe("GET /seasons/:id", () => {
	test("returns season when found", async () => {
		const res = await app.handle(new Request("http://localhost/seasons/1"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe(1);
		expect(body.name).toBe("Season 1");
		expect(getSeasonById).toHaveBeenCalledTimes(1);
	});

	test("returns 404 when season not found", async () => {
		getSeasonById.mockImplementationOnce((() =>
			Promise.resolve(null)) as never);
		const res = await app.handle(new Request("http://localhost/seasons/999"));
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("NOT_FOUND");
		expect(body.error).toBe("Season not found");
	});
});
