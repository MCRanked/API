import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	getAuthorizationUrl,
	getMinecraftProfile,
} from "../../src/lib/microsoft-auth";

const originalFetch = globalThis.fetch;

describe("getAuthorizationUrl", () => {
	test("returns a URL starting with the Microsoft auth endpoint", () => {
		const url = getAuthorizationUrl();
		expect(url).toStartWith("https://login.live.com/oauth20_authorize.srf");
	});

	test("includes correct query params", () => {
		const url = getAuthorizationUrl();
		const parsed = new URL(url);
		expect(parsed.searchParams.get("client_id")).toBe("test");
		expect(parsed.searchParams.get("response_type")).toBe("code");
		expect(parsed.searchParams.get("redirect_uri")).toBe(
			"http://localhost:3000/callback",
		);
		expect(parsed.searchParams.get("scope")).toBe(
			"XboxLive.signin offline_access",
		);
	});
});

describe("getMinecraftProfile", () => {
	beforeEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("returns {id, name} on success", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						id: "abc123",
						name: "TestPlayer",
					}),
					{ status: 200 },
				),
			),
		) as unknown as typeof fetch;

		const profile = await getMinecraftProfile("valid-token");
		expect(profile).toEqual({ id: "abc123", name: "TestPlayer" });
	});

	test("throws on non-ok response", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
				}),
			),
		) as unknown as typeof fetch;

		expect(getMinecraftProfile("bad-token")).rejects.toThrow(
			"Failed to fetch Minecraft profile",
		);
	});
});
