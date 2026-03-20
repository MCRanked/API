import { beforeEach, describe, expect, mock, test } from "bun:test";

// --- Mock service and library modules BEFORE importing routes ---

const mockGetAuthorizationUrl = mock(() => "https://login.live.com/mock-auth");
const mockExchangeCodeForProfile = mock(() =>
	Promise.resolve({
		id: "abcdef1234567890abcdef1234567890",
		name: "TestPlayer",
	}),
);

mock.module("../../src/lib/microsoft-auth", () => ({
	getAuthorizationUrl: mockGetAuthorizationUrl,
	exchangeCodeForProfile: mockExchangeCodeForProfile,
}));

const mockVerifyMinecraftToken = mock(() =>
	Promise.resolve({
		id: "abcdef1234567890abcdef1234567890",
		name: "TestPlayer",
	}),
);

mock.module("../../src/lib/minecraft-auth", () => ({
	verifyMinecraftToken: mockVerifyMinecraftToken,
}));

const mockAuthenticateMinecraftProfile = mock(() =>
	Promise.resolve({
		accessToken: "mock-access-token",
		refreshToken: "mock-refresh-token",
		user: {
			id: "user-123",
			minecraftUuid: "abcdef12-3456-7890-abcd-ef1234567890",
			username: "TestPlayer",
		},
	}),
);
const mockRefreshSession = mock(() =>
	Promise.resolve({
		accessToken: "new-access-token",
		refreshToken: "new-refresh-token",
	}),
);
const mockLogout = mock(() => Promise.resolve());

mock.module("../../src/modules/auth/service", () => ({
	authenticateMinecraftProfile: mockAuthenticateMinecraftProfile,
	refreshSession: mockRefreshSession,
	logout: mockLogout,
}));

import { Elysia } from "elysia";
import { signAccessToken } from "../../src/lib/jwt";
import { errorHandler } from "../../src/middleware/error";
import { authRoutes } from "../../src/modules/auth/routes";

const app = new Elysia().use(errorHandler).use(authRoutes);

beforeEach(() => {
	mockGetAuthorizationUrl.mockClear();
	mockExchangeCodeForProfile.mockClear();
	mockVerifyMinecraftToken.mockClear();
	mockAuthenticateMinecraftProfile.mockClear();
	mockRefreshSession.mockClear();
	mockLogout.mockClear();
});

describe("Auth Routes", () => {
	// --- GET /auth/login ---
	describe("GET /auth/login", () => {
		test("returns a redirect (302)", async () => {
			const res = await app.handle(new Request("http://localhost/auth/login"));
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe(
				"https://login.live.com/mock-auth",
			);
		});

		test("calls getAuthorizationUrl", async () => {
			await app.handle(new Request("http://localhost/auth/login"));
			expect(mockGetAuthorizationUrl).toHaveBeenCalled();
		});
	});

	// --- GET /auth/callback ---
	describe("GET /auth/callback", () => {
		test("without code query param returns 422 (validation error)", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/callback"),
			);
			// Elysia ValidationError is caught by errorHandler as a generic error
			expect(res.status).toBe(422);
		});

		test("with valid code exchanges and returns tokens", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/callback?code=test-auth-code"),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.access_token).toBe("mock-access-token");
			expect(body.user).toEqual({
				id: "user-123",
				minecraftUuid: "abcdef12-3456-7890-abcd-ef1234567890",
				username: "TestPlayer",
			});
			expect(mockExchangeCodeForProfile).toHaveBeenCalledWith("test-auth-code");
			expect(mockAuthenticateMinecraftProfile).toHaveBeenCalled();
		});

		test("sets refresh_token cookie on successful callback", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/callback?code=test-code"),
			);
			const setCookie = res.headers.get("set-cookie");
			expect(setCookie).toContain("refresh_token=mock-refresh-token");
			expect(setCookie).toContain("HttpOnly");
		});
	});

	// --- POST /auth/verify ---
	describe("POST /auth/verify", () => {
		test("without body returns 422", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				}),
			);
			// ValidationError: missing required 'token' field
			expect(res.status).toBe(422);
		});

		test("with valid body calls service and returns tokens", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ token: "mc-access-token" }),
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.access_token).toBe("mock-access-token");
			expect(body.refresh_token).toBe("mock-refresh-token");
			expect(body.user).toEqual({
				id: "user-123",
				minecraftUuid: "abcdef12-3456-7890-abcd-ef1234567890",
				username: "TestPlayer",
			});
			expect(mockVerifyMinecraftToken).toHaveBeenCalledWith("mc-access-token");
			expect(mockAuthenticateMinecraftProfile).toHaveBeenCalled();
		});
	});

	// --- POST /auth/refresh ---
	describe("POST /auth/refresh", () => {
		test("without any token returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/refresh", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				}),
			);
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.code).toBe("UNAUTHORIZED");
		});

		test("with refresh_token in body returns new tokens", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/refresh", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refresh_token: "valid-refresh-token" }),
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.access_token).toBe("new-access-token");
			expect(body.refresh_token).toBe("new-refresh-token");
			expect(mockRefreshSession).toHaveBeenCalledWith("valid-refresh-token");
		});
	});

	// --- POST /auth/logout ---
	describe("POST /auth/logout", () => {
		test("without auth header returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/logout", {
					method: "POST",
				}),
			);
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.code).toBe("UNAUTHORIZED");
		});

		test("with invalid token returns 401", async () => {
			const res = await app.handle(
				new Request("http://localhost/auth/logout", {
					method: "POST",
					headers: { Authorization: "Bearer invalid-token" },
				}),
			);
			expect(res.status).toBe(401);
		});

		test("with valid auth token logs out and returns success", async () => {
			const token = await signAccessToken({
				sub: "user-123",
				minecraft_uuid: "mc-uuid-456",
				username: "TestPlayer",
			});
			const res = await app.handle(
				new Request("http://localhost/auth/logout", {
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
				}),
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(mockLogout).toHaveBeenCalledWith("user-123");
		});
	});
});
