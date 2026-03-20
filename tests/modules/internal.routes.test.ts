import { beforeEach, describe, expect, mock, test } from "bun:test";

// ── Mocks (must be set up before importing routes) ──────────────────────────

const mockSubmitMatch = mock(() =>
	Promise.resolve({ id: "match-1", status: "completed" }),
);
const mockVoidMatch = mock(() => Promise.resolve({ success: true }));
const mockIssuePunishment = mock(() => Promise.resolve({ id: 1, type: "ban" }));
const mockRevokePunishment = mock(() => Promise.resolve({ success: true }));
const mockCheckSessionValid = mock(() => Promise.resolve({ valid: true }));
const mockGetActivePunishments = mock(() => Promise.resolve([]));
const mockGetActiveLoadout = mock(() =>
	Promise.resolve({ inventory: {}, source: "kit_default" }),
);

mock.module("../../src/modules/internal/service", () => ({
	submitMatch: mockSubmitMatch,
	voidMatch: mockVoidMatch,
	issuePunishment: mockIssuePunishment,
	revokePunishment: mockRevokePunishment,
	checkSessionValid: mockCheckSessionValid,
	getActivePunishments: mockGetActivePunishments,
	getActiveLoadout: mockGetActiveLoadout,
}));

const mockInsertReturning = mock(() => Promise.resolve([{ id: 1 }]));
const mockInsertValues = mock(() => ({ returning: mockInsertReturning }));
const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockUpdateWhere = mock(() => Promise.resolve());
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

mock.module("../../src/db", () => ({
	db: {
		insert: mockInsert,
		update: mockUpdate,
	},
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { Elysia } from "elysia";
import { errorHandler } from "../../src/middleware/error";
import { internalRoutes } from "../../src/modules/internal/routes";

// ── App under test ──────────────────────────────────────────────────────────

const app = new Elysia().use(errorHandler).use(internalRoutes);

const VALID_HEADERS = { "x-api-key": "test-api-key" };
const BASE = "http://localhost";

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonReq(
	method: string,
	path: string,
	body?: unknown,
	headers?: Record<string, string>,
) {
	const init: RequestInit = {
		method,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	};
	if (body !== undefined) {
		init.body = JSON.stringify(body);
	}
	return new Request(`${BASE}${path}`, init);
}

// ── Valid request bodies ────────────────────────────────────────────────────

const validMatchBody = {
	kit_id: 1,
	winner_minecraft_uuid: "aaaa-bbbb",
	loser_minecraft_uuid: "cccc-dddd",
	region: "us-east",
	node_id: "node-1",
	duration_ms: 120000,
	decisiveness_score: 0.8,
	integrity_score: 1.0,
};

const validPunishmentBody = {
	minecraft_uuid: "aaaa-bbbb",
	type: "ban",
	reason: "Cheating",
	issued_by: "admin-1",
};

const validSeasonBody = {
	kit_id: 1,
	number: 1,
	starts_at: "2026-01-01T00:00:00Z",
	active: true,
	config: { elo: { default_rating: 1000 } },
};

const validKitBody = {
	slug: "sword",
	name: "Sword",
	version_range: "1.8-1.21",
	ruleset: { allow_shield: false },
};

// ── Reset mocks before each test ───────────────────────────────────────────

beforeEach(() => {
	mockSubmitMatch.mockClear();
	mockVoidMatch.mockClear();
	mockIssuePunishment.mockClear();
	mockRevokePunishment.mockClear();
	mockCheckSessionValid.mockClear();
	mockGetActivePunishments.mockClear();
	mockGetActiveLoadout.mockClear();
	mockInsert.mockClear();
	mockInsertValues.mockClear();
	mockInsertReturning.mockClear();
	mockUpdate.mockClear();
	mockUpdateSet.mockClear();
	mockUpdateWhere.mockClear();
});

// ═══════════════════════════════════════════════════════════════════════════
// API Key Guard — all endpoints
// ═══════════════════════════════════════════════════════════════════════════

describe("Internal routes — API key guard", () => {
	const endpoints: [string, string][] = [
		["POST", "/internal/v1/matches"],
		["POST", "/internal/v1/matches/some-id/void"],
		["POST", "/internal/v1/punishments"],
		["DELETE", "/internal/v1/punishments/1"],
		["GET", "/internal/v1/users/some-uuid/session-valid"],
		["GET", "/internal/v1/users/some-uuid/active-punishments"],
		["GET", "/internal/v1/users/some-uuid/loadout/sword"],
		["POST", "/internal/v1/seasons"],
		["PATCH", "/internal/v1/seasons/1"],
		["POST", "/internal/v1/kits"],
		["PATCH", "/internal/v1/kits/sword"],
	];

	for (const [method, path] of endpoints) {
		test(`${method} ${path} rejects request without API key (401)`, async () => {
			const res = await app.handle(new Request(`${BASE}${path}`, { method }));
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.code).toBe("UNAUTHORIZED");
		});

		test(`${method} ${path} rejects request with invalid API key (401)`, async () => {
			const res = await app.handle(
				new Request(`${BASE}${path}`, {
					method,
					headers: { "x-api-key": "wrong-key" },
				}),
			);
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.code).toBe("UNAUTHORIZED");
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /internal/v1/matches
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /internal/v1/matches", () => {
	test("with valid body calls submitMatch and returns result", async () => {
		const res = await app.handle(
			jsonReq("POST", "/internal/v1/matches", validMatchBody, VALID_HEADERS),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ id: "match-1", status: "completed" });
		expect(mockSubmitMatch).toHaveBeenCalledTimes(1);
	});

	test("without body rejects with error", async () => {
		const res = await app.handle(
			new Request(`${BASE}/internal/v1/matches`, {
				method: "POST",
				headers: { ...VALID_HEADERS },
			}),
		);
		expect(res.status).not.toBe(200);
		expect(mockSubmitMatch).not.toHaveBeenCalled();
	});

	test("with missing required fields rejects with error", async () => {
		const res = await app.handle(
			jsonReq("POST", "/internal/v1/matches", { kit_id: 1 }, VALID_HEADERS),
		);
		expect(res.status).not.toBe(200);
		expect(mockSubmitMatch).not.toHaveBeenCalled();
	});

	test("with decisiveness_score out of range rejects with error", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/matches",
				{ ...validMatchBody, decisiveness_score: 1.5 },
				VALID_HEADERS,
			),
		);
		expect(res.status).not.toBe(200);
		expect(mockSubmitMatch).not.toHaveBeenCalled();
	});

	test("with integrity_score out of range rejects with error", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/matches",
				{ ...validMatchBody, integrity_score: -0.1 },
				VALID_HEADERS,
			),
		);
		expect(res.status).not.toBe(200);
		expect(mockSubmitMatch).not.toHaveBeenCalled();
	});

	test("accepts optional metadata field", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/matches",
				{ ...validMatchBody, metadata: { source: "test" } },
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		expect(mockSubmitMatch).toHaveBeenCalledTimes(1);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /internal/v1/matches/:id/void
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /internal/v1/matches/:id/void", () => {
	test("with valid API key calls voidMatch and returns result", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/matches/match-123/void",
				undefined,
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
		expect(mockVoidMatch).toHaveBeenCalledTimes(1);
		expect(mockVoidMatch).toHaveBeenCalledWith("match-123");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /internal/v1/punishments
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /internal/v1/punishments", () => {
	test("with valid body calls issuePunishment and returns result", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/punishments",
				validPunishmentBody,
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ id: 1, type: "ban" });
		expect(mockIssuePunishment).toHaveBeenCalledTimes(1);
	});

	test("without required fields rejects with error", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/punishments",
				{ minecraft_uuid: "aaaa-bbbb" },
				VALID_HEADERS,
			),
		);
		expect(res.status).not.toBe(200);
		expect(mockIssuePunishment).not.toHaveBeenCalled();
	});

	test("without body rejects with error", async () => {
		const res = await app.handle(
			new Request(`${BASE}/internal/v1/punishments`, {
				method: "POST",
				headers: { ...VALID_HEADERS },
			}),
		);
		expect(res.status).not.toBe(200);
		expect(mockIssuePunishment).not.toHaveBeenCalled();
	});

	test("accepts optional evidence_ref and expires_at", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/punishments",
				{
					...validPunishmentBody,
					evidence_ref: "clip-abc",
					expires_at: "2026-12-31T00:00:00Z",
				},
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		expect(mockIssuePunishment).toHaveBeenCalledTimes(1);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /internal/v1/punishments/:id
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /internal/v1/punishments/:id", () => {
	test("with valid API key calls revokePunishment and returns result", async () => {
		const res = await app.handle(
			jsonReq(
				"DELETE",
				"/internal/v1/punishments/42",
				undefined,
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
		expect(mockRevokePunishment).toHaveBeenCalledTimes(1);
		expect(mockRevokePunishment).toHaveBeenCalledWith(42);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /internal/v1/users/:uuid/session-valid
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /internal/v1/users/:uuid/session-valid", () => {
	test("with valid API key returns session validity", async () => {
		const res = await app.handle(
			jsonReq(
				"GET",
				"/internal/v1/users/player-uuid/session-valid",
				undefined,
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ valid: true });
		expect(mockCheckSessionValid).toHaveBeenCalledTimes(1);
		expect(mockCheckSessionValid).toHaveBeenCalledWith("player-uuid");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /internal/v1/users/:uuid/active-punishments
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /internal/v1/users/:uuid/active-punishments", () => {
	test("with valid API key returns active punishments", async () => {
		const res = await app.handle(
			jsonReq(
				"GET",
				"/internal/v1/users/player-uuid/active-punishments",
				undefined,
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual([]);
		expect(mockGetActivePunishments).toHaveBeenCalledTimes(1);
		expect(mockGetActivePunishments).toHaveBeenCalledWith("player-uuid");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /internal/v1/users/:uuid/loadout/:kitSlug
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /internal/v1/users/:uuid/loadout/:kitSlug", () => {
	test("with valid API key returns loadout", async () => {
		const res = await app.handle(
			jsonReq(
				"GET",
				"/internal/v1/users/player-uuid/loadout/sword",
				undefined,
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ inventory: {}, source: "kit_default" });
		expect(mockGetActiveLoadout).toHaveBeenCalledTimes(1);
		expect(mockGetActiveLoadout).toHaveBeenCalledWith("player-uuid", "sword");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /internal/v1/seasons
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /internal/v1/seasons", () => {
	test("with valid body creates season via db and returns it", async () => {
		const res = await app.handle(
			jsonReq("POST", "/internal/v1/seasons", validSeasonBody, VALID_HEADERS),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ id: 1 });
		expect(mockInsert).toHaveBeenCalledTimes(1);
	});

	test("without required fields rejects with error", async () => {
		const res = await app.handle(
			jsonReq("POST", "/internal/v1/seasons", { kit_id: 1 }, VALID_HEADERS),
		);
		expect(res.status).not.toBe(200);
		expect(mockInsert).not.toHaveBeenCalled();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /internal/v1/seasons/:id
// ═══════════════════════════════════════════════════════════════════════════

describe("PATCH /internal/v1/seasons/:id", () => {
	test("with valid body updates season and returns success", async () => {
		const res = await app.handle(
			jsonReq(
				"PATCH",
				"/internal/v1/seasons/1",
				{ active: false },
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledTimes(1);
	});

	test("with empty body still succeeds", async () => {
		const res = await app.handle(
			jsonReq("PATCH", "/internal/v1/seasons/1", {}, VALID_HEADERS),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /internal/v1/kits
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /internal/v1/kits", () => {
	test("with valid body creates kit via db and returns it", async () => {
		const res = await app.handle(
			jsonReq("POST", "/internal/v1/kits", validKitBody, VALID_HEADERS),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ id: 1 });
		expect(mockInsert).toHaveBeenCalledTimes(1);
	});

	test("without required fields rejects with error", async () => {
		const res = await app.handle(
			jsonReq("POST", "/internal/v1/kits", { slug: "sword" }, VALID_HEADERS),
		);
		expect(res.status).not.toBe(200);
		expect(mockInsert).not.toHaveBeenCalled();
	});

	test("accepts optional fields", async () => {
		const res = await app.handle(
			jsonReq(
				"POST",
				"/internal/v1/kits",
				{
					...validKitBody,
					description: "Classic sword kit",
					icon: "sword.png",
					category: "pvp",
					display_order: 5,
					allow_custom_loadouts: true,
					default_inventory: { slot0: "diamond_sword" },
				},
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		expect(mockInsert).toHaveBeenCalledTimes(1);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /internal/v1/kits/:slug
// ═══════════════════════════════════════════════════════════════════════════

describe("PATCH /internal/v1/kits/:slug", () => {
	test("with valid body updates kit and returns success", async () => {
		const res = await app.handle(
			jsonReq(
				"PATCH",
				"/internal/v1/kits/sword",
				{ name: "Updated Sword" },
				VALID_HEADERS,
			),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
		expect(mockUpdate).toHaveBeenCalledTimes(1);
	});

	test("with empty body still succeeds", async () => {
		const res = await app.handle(
			jsonReq("PATCH", "/internal/v1/kits/sword", {}, VALID_HEADERS),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true });
	});
});
