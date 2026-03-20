import { describe, expect, test } from "bun:test";
import { decayRating } from "../../src/lib/decay";
import type { SeasonConfig } from "../../src/lib/elo";

// Note: Full integration testing requires a running DB.
// This test verifies the decay logic in isolation.

describe("decay logic", () => {
	test("decayRating computes new elo correctly", async () => {
		const { decayRating } = await import("../../src/lib/decay");
		const result = decayRating(1850, 5, 1600);
		expect(result).toBe(1845);
	});

	test("decayRating floors at floor_elo", async () => {
		const { decayRating } = await import("../../src/lib/decay");
		const result = decayRating(1602, 5, 1600);
		expect(result).toBe(1600);
	});

	test("decayRating does not go below floor", async () => {
		const { decayRating } = await import("../../src/lib/decay");
		const result = decayRating(1601, 5, 1600);
		expect(result).toBe(1600);
	});
});
