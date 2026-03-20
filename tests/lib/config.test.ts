import { describe, expect, test } from "bun:test";
import { config } from "../../src/config";

describe("config", () => {
	test("loads successfully when all env vars are set", () => {
		expect(config).toBeDefined();
		expect(config.databaseUrl).toBe("postgres://test:test@localhost:5432/test");
		expect(config.microsoftClientId).toBe("test");
		expect(config.microsoftClientSecret).toBe("test");
		expect(config.microsoftRedirectUri).toBe("http://localhost:3000/callback");
		expect(config.jwtSecret).toBe("test-secret-key-that-is-at-least-32-chars");
		expect(config.internalApiKey).toBe("test-api-key");
	});

	test("port defaults to 3000 when PORT not set", () => {
		// PORT is not set in setup.ts, so it should default to 3000
		expect(config.port).toBe(3000);
	});

	test("host defaults to '0.0.0.0' when HOST not set", () => {
		// HOST is not set in setup.ts, so it should default to "0.0.0.0"
		expect(config.host).toBe("0.0.0.0");
	});

	test("has correct static values", () => {
		expect(config.jwtAccessExpiresIn).toBe("15m");
		expect(config.jwtRefreshExpiresInDays).toBe(30);
	});
});
