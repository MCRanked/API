import { beforeEach, describe, expect, mock, test } from "bun:test";
import { verifyMinecraftToken } from "../../src/lib/minecraft-auth";

const originalFetch = globalThis.fetch;

describe("verifyMinecraftToken", () => {
	beforeEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("returns profile on success", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						id: "550e8400e29b41d4a716446655440000",
						name: "StevePlayer",
					}),
					{ status: 200 },
				),
			),
		) as unknown as typeof fetch;

		const profile = await verifyMinecraftToken("valid-mc-token");
		expect(profile).toEqual({
			id: "550e8400e29b41d4a716446655440000",
			name: "StevePlayer",
		});
	});

	test("throws on invalid token", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
				}),
			),
		) as unknown as typeof fetch;

		expect(verifyMinecraftToken("invalid-token")).rejects.toThrow(
			"Failed to fetch Minecraft profile",
		);
	});
});
