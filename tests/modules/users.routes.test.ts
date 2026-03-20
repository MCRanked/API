import { beforeEach, describe, expect, mock, test } from "bun:test";

// --- Mock service modules BEFORE importing routes ---

const mockGetUserByUuid = mock(() =>
	Promise.resolve({
		id: "user-123",
		minecraftUuid: "abcdef12-3456-7890-abcd-ef1234567890",
		username: "TestPlayer",
		versionPreference: null,
		language: "en",
		preferences: {},
		createdAt: new Date("2025-01-01"),
		lastSeenAt: new Date("2025-06-01"),
	}),
);
const mockGetUserById = mock(() =>
	Promise.resolve({
		id: "user-123",
		minecraftUuid: "abcdef12-3456-7890-abcd-ef1234567890",
		username: "TestPlayer",
		versionPreference: null,
		language: "en",
		preferences: {},
		createdAt: new Date("2025-01-01"),
		lastSeenAt: new Date("2025-06-01"),
	}),
);
const mockGetUserRatings = mock(() =>
	Promise.resolve([
		{
			id: "r1",
			userId: "user-123",
			kitId: "kit-1",
			rating: 1200,
			deviation: 50,
		},
	]),
);
const mockUpdatePreferences = mock(() => Promise.resolve());
const mockGetLoadouts = mock(() =>
	Promise.resolve([
		{
			id: "l1",
			userId: "user-123",
			kitId: "kit-1",
			name: "default",
			inventory: {},
		},
	]),
);
const mockSaveLoadout = mock(() =>
	Promise.resolve({
		id: "l2",
		userId: "user-123",
		kitId: "kit-1",
		name: "custom",
		inventory: { slot1: "diamond_sword" },
	}),
);
const mockDeleteLoadout = mock(() => Promise.resolve());

mock.module("../../src/modules/users/service", () => ({
	getUserByUuid: mockGetUserByUuid,
	getUserById: mockGetUserById,
	getUserRatings: mockGetUserRatings,
	updatePreferences: mockUpdatePreferences,
	getLoadouts: mockGetLoadouts,
	saveLoadout: mockSaveLoadout,
	deleteLoadout: mockDeleteLoadout,
}));

const mockGetUserMatches = mock(() =>
	Promise.resolve({
		data: [{ id: "m1", winnerId: "user-123", loserId: "user-456" }],
		next_cursor: null,
	}),
);

mock.module("../../src/modules/matches/service", () => ({
	getUserMatches: mockGetUserMatches,
}));

import { Elysia } from "elysia";
import { signAccessToken } from "../../src/lib/jwt";
import { errorHandler } from "../../src/middleware/error";
import { usersRoutes } from "../../src/modules/users/routes";

const app = new Elysia().use(errorHandler).use(usersRoutes);

async function validToken(overrides?: Record<string, string>) {
	return signAccessToken({
		sub: "user-123",
		minecraft_uuid: "abcdef12-3456-7890-abcd-ef1234567890",
		username: "TestPlayer",
		...overrides,
	});
}

beforeEach(() => {
	mockGetUserByUuid.mockClear();
	mockGetUserById.mockClear();
	mockGetUserRatings.mockClear();
	mockUpdatePreferences.mockClear();
	mockGetLoadouts.mockClear();
	mockSaveLoadout.mockClear();
	mockDeleteLoadout.mockClear();
	mockGetUserMatches.mockClear();
});

describe("Users Routes", () => {
	// --- GET /users/:uuid ---
	describe("GET /users/:uuid", () => {
		test("returns user data for a valid UUID", async () => {
			const res = await app.handle(
				new Request(
					"http://localhost/users/abcdef12-3456-7890-abcd-ef1234567890",
				),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.id).toBe("user-123");
			expect(body.username).toBe("TestPlayer");
			expect(mockGetUserByUuid).toHaveBeenCalledWith(
				"abcdef12-3456-7890-abcd-ef1234567890",
			);
		});

		test("returns 404 when user is not found", async () => {
			mockGetUserByUuid.mockImplementationOnce((() =>
				Promise.resolve(null)) as never);
			const res = await app.handle(
				new Request("http://localhost/users/nonexistent-uuid"),
			);
			expect(res.status).toBe(404);
			const body = await res.json();
			expect(body.code).toBe("NOT_FOUND");
		});
	});

	// --- GET /users/:uuid/ratings ---
	describe("GET /users/:uuid/ratings", () => {
		test("returns ratings for a valid user", async () => {
			const res = await app.handle(
				new Request(
					"http://localhost/users/abcdef12-3456-7890-abcd-ef1234567890/ratings",
				),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(Array.isArray(body)).toBe(true);
			expect(body[0].rating).toBe(1200);
		});

		test("returns 404 when user has no ratings (null result)", async () => {
			mockGetUserRatings.mockImplementationOnce((() =>
				Promise.resolve(null)) as never);
			const res = await app.handle(
				new Request("http://localhost/users/nonexistent-uuid/ratings"),
			);
			expect(res.status).toBe(404);
		});
	});

	// --- GET /users/:uuid/matches ---
	describe("GET /users/:uuid/matches", () => {
		test("returns paginated matches for a valid user", async () => {
			const res = await app.handle(
				new Request(
					"http://localhost/users/abcdef12-3456-7890-abcd-ef1234567890/matches",
				),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.data).toBeDefined();
			expect(mockGetUserMatches).toHaveBeenCalled();
		});

		test("passes limit and cursor query params to service", async () => {
			await app.handle(
				new Request(
					"http://localhost/users/abcdef12-3456-7890-abcd-ef1234567890/matches?limit=10&cursor=abc",
				),
			);
			expect(mockGetUserMatches).toHaveBeenCalledWith(
				"abcdef12-3456-7890-abcd-ef1234567890",
				10,
				"abc",
			);
		});

		test("returns 404 when user is not found", async () => {
			mockGetUserMatches.mockImplementationOnce((() =>
				Promise.resolve(null)) as never);
			const res = await app.handle(
				new Request("http://localhost/users/nonexistent-uuid/matches"),
			);
			expect(res.status).toBe(404);
		});
	});

	// --- GET /users/me ---
	describe("GET /users/me", () => {
		test("without auth returns 401", async () => {
			const res = await app.handle(new Request("http://localhost/users/me"));
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.code).toBe("UNAUTHORIZED");
		});

		test("with valid JWT returns user data", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.id).toBe("user-123");
			expect(body.username).toBe("TestPlayer");
			expect(mockGetUserById).toHaveBeenCalledWith("user-123");
		});

		test("with invalid JWT returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/users/me", {
					headers: { Authorization: "Bearer bad-token" },
				}),
			);
			expect(res.status).toBe(401);
		});
	});

	// --- PATCH /users/me/preferences ---
	describe("PATCH /users/me/preferences", () => {
		test("without auth returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/users/me/preferences", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ language: "es" }),
				}),
			);
			expect(res.status).toBe(401);
		});

		test("with auth and valid body returns success", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me/preferences", {
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ language: "es", version_preference: "1.8" }),
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(mockUpdatePreferences).toHaveBeenCalledWith("user-123", {
				language: "es",
				version_preference: "1.8",
			});
		});

		test("with auth and empty body returns success (no changes)", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me/preferences", {
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
		});
	});

	// --- GET /users/me/loadouts ---
	describe("GET /users/me/loadouts", () => {
		test("without auth returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts"),
			);
			expect(res.status).toBe(401);
		});

		test("with auth returns loadouts", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(Array.isArray(body)).toBe(true);
			expect(body[0].name).toBe("default");
			expect(mockGetLoadouts).toHaveBeenCalledWith("user-123");
		});
	});

	// --- PUT /users/me/loadouts/:kitSlug/:name ---
	describe("PUT /users/me/loadouts/:kitSlug/:name", () => {
		test("without auth returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts/sword/primary", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ inventory: { slot1: "diamond_sword" } }),
				}),
			);
			expect(res.status).toBe(401);
		});

		test("with auth and valid body saves loadout", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts/sword/primary", {
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ inventory: { slot1: "diamond_sword" } }),
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.name).toBe("custom");
			expect(mockSaveLoadout).toHaveBeenCalledWith(
				"user-123",
				"sword",
				"primary",
				{ slot1: "diamond_sword" },
			);
		});

		test("without body returns 422", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts/sword/primary", {
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}),
			);
			expect(res.status).toBe(422);
		});
	});

	// --- DELETE /users/me/loadouts/:kitSlug/:name ---
	describe("DELETE /users/me/loadouts/:kitSlug/:name", () => {
		test("without auth returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts/sword/primary", {
					method: "DELETE",
				}),
			);
			expect(res.status).toBe(401);
		});

		test("with auth deletes loadout and returns success", async () => {
			const token = await validToken();
			const res = await app.handle(
				new Request("http://localhost/users/me/loadouts/sword/primary", {
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(mockDeleteLoadout).toHaveBeenCalledWith(
				"user-123",
				"sword",
				"primary",
			);
		});
	});
});
