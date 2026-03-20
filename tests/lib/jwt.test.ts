import { describe, expect, test } from "bun:test";
import {
	generateRefreshToken,
	hashRefreshToken,
	signAccessToken,
	verifyAccessToken,
} from "../../src/lib/jwt";

describe("JWT", () => {
	const payload = {
		sub: "user-uuid-123",
		minecraft_uuid: "mc-uuid-456",
		username: "TestPlayer",
	};

	test("signAccessToken returns a valid JWT string", async () => {
		const token = await signAccessToken(payload);
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(3);
	});

	test("verifyAccessToken decodes a valid token", async () => {
		const token = await signAccessToken(payload);
		const decoded = await verifyAccessToken(token);
		expect(decoded.sub).toBe("user-uuid-123");
		expect(decoded.minecraft_uuid).toBe("mc-uuid-456");
		expect(decoded.username).toBe("TestPlayer");
	});

	test("verifyAccessToken rejects a tampered token", async () => {
		const token = await signAccessToken(payload);
		const tampered = `${token}x`;
		expect(verifyAccessToken(tampered)).rejects.toThrow();
	});
});

describe("Refresh Token", () => {
	test("generateRefreshToken returns 128 hex chars (64 bytes)", () => {
		const token = generateRefreshToken();
		expect(token).toHaveLength(128);
		expect(token).toMatch(/^[0-9a-f]+$/);
	});

	test("hashRefreshToken produces consistent SHA-256 hash", async () => {
		const token = generateRefreshToken();
		const hash1 = await hashRefreshToken(token);
		const hash2 = await hashRefreshToken(token);
		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64);
	});

	test("different tokens produce different hashes", async () => {
		const token1 = generateRefreshToken();
		const token2 = generateRefreshToken();
		const hash1 = await hashRefreshToken(token1);
		const hash2 = await hashRefreshToken(token2);
		expect(hash1).not.toBe(hash2);
	});
});
