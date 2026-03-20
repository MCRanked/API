import { beforeEach, describe, expect, mock, test } from "bun:test";

const listActiveKits = mock(() =>
	Promise.resolve([
		{ id: 1, slug: "sword", name: "Sword", active: true, displayOrder: 1 },
		{ id: 2, slug: "axe", name: "Axe", active: true, displayOrder: 2 },
	]),
);
const getKitBySlug = mock(() =>
	Promise.resolve({
		id: 1,
		slug: "sword",
		name: "Sword",
		active: true,
		displayOrder: 1,
	}),
);

mock.module("../../src/modules/kits/service", () => ({
	listActiveKits,
	getKitBySlug,
}));

import { Elysia } from "elysia";
import { errorHandler } from "../../src/middleware/error";
import { kitsRoutes } from "../../src/modules/kits/routes";

const app = new Elysia().use(errorHandler).use(kitsRoutes);

beforeEach(() => {
	listActiveKits.mockClear();
	getKitBySlug.mockClear();
});

describe("GET /kits", () => {
	test("returns list of active kits", async () => {
		const res = await app.handle(new Request("http://localhost/kits"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(2);
		expect(body[0].slug).toBe("sword");
		expect(body[1].slug).toBe("axe");
		expect(listActiveKits).toHaveBeenCalledTimes(1);
	});
});

describe("GET /kits/:slug", () => {
	test("returns kit when found", async () => {
		const res = await app.handle(new Request("http://localhost/kits/sword"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.slug).toBe("sword");
		expect(body.name).toBe("Sword");
		expect(getKitBySlug).toHaveBeenCalledTimes(1);
	});

	test("returns 404 when kit not found", async () => {
		getKitBySlug.mockImplementationOnce((() => Promise.resolve(null)) as never);
		const res = await app.handle(
			new Request("http://localhost/kits/nonexistent"),
		);
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.code).toBe("NOT_FOUND");
		expect(body.error).toBe("Kit not found");
	});
});
