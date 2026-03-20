import { describe, expect, test } from "bun:test";
import {
	calculateElo,
	getKFactor,
	getDecisivenessMultiplier,
	getIntegrityMultiplier,
	deriveRank,
} from "../../src/lib/elo";
import type { SeasonConfig } from "../../src/lib/elo";

const defaultConfig: SeasonConfig = {
	elo: {
		default_rating: 1000,
		base_divisor: 400,
		k_factors: {
			placement: { max_games: 10, k: 40 },
			established: { max_games: 100, k: 25 },
			veteran: { k: 16 },
		},
		decisiveness: {
			min_multiplier: 0.8,
			mid_multiplier: 1.0,
			max_multiplier: 1.25,
		},
		integrity: {
			perfect: 1.0,
			minor_threshold: 0.7,
			minor_multiplier: 0.85,
			degraded_threshold: 0.5,
			degraded_multiplier: 0.7,
			floor_multiplier: 0.5,
		},
		placement_matches: 10,
	},
	ranks: [
		{ name: "Unranked", min_elo: null, placement_required: false },
		{ name: "Bronze", min_elo: 0 },
		{ name: "Silver", min_elo: 1000 },
		{ name: "Gold", min_elo: 1200 },
		{ name: "Platinum", min_elo: 1400 },
		{ name: "Diamond", min_elo: 1600 },
		{ name: "Master", min_elo: 1800 },
		{ name: "Champion", min_elo: 2000 },
	],
	decay: {
		enabled: true,
		min_elo: 1800,
		inactivity_days: 14,
		points_per_day: 5,
		floor_elo: 1600,
	},
};

describe("getKFactor", () => {
	test("returns placement K for new players", () => {
		expect(getKFactor(5, defaultConfig)).toBe(40);
	});

	test("returns established K for mid-range players", () => {
		expect(getKFactor(50, defaultConfig)).toBe(25);
	});

	test("returns veteran K for experienced players", () => {
		expect(getKFactor(150, defaultConfig)).toBe(16);
	});

	test("placement boundary is exclusive", () => {
		expect(getKFactor(10, defaultConfig)).toBe(25);
	});
});

describe("getDecisivenessMultiplier", () => {
	test("score 0.0 returns min_multiplier", () => {
		expect(getDecisivenessMultiplier(0.0, defaultConfig)).toBeCloseTo(0.8);
	});

	test("score 0.5 returns mid_multiplier", () => {
		expect(getDecisivenessMultiplier(0.5, defaultConfig)).toBeCloseTo(1.0);
	});

	test("score 1.0 returns max_multiplier", () => {
		expect(getDecisivenessMultiplier(1.0, defaultConfig)).toBeCloseTo(1.25);
	});

	test("score 0.25 interpolates between min and mid", () => {
		// halfway between 0.8 and 1.0 = 0.9
		expect(getDecisivenessMultiplier(0.25, defaultConfig)).toBeCloseTo(0.9);
	});

	test("score 0.75 interpolates between mid and max", () => {
		// halfway between 1.0 and 1.25 = 1.125
		expect(getDecisivenessMultiplier(0.75, defaultConfig)).toBeCloseTo(
			1.125,
		);
	});
});

describe("getIntegrityMultiplier", () => {
	test("perfect score returns 1.0", () => {
		expect(getIntegrityMultiplier(1.0, defaultConfig)).toBe(1.0);
	});

	test("above minor threshold but below perfect returns minor_multiplier", () => {
		expect(getIntegrityMultiplier(0.85, defaultConfig)).toBe(0.85);
		expect(getIntegrityMultiplier(0.7, defaultConfig)).toBe(0.85);
	});

	test("above degraded threshold returns degraded_multiplier", () => {
		expect(getIntegrityMultiplier(0.6, defaultConfig)).toBe(0.7);
		expect(getIntegrityMultiplier(0.5, defaultConfig)).toBe(0.7);
	});

	test("below degraded threshold returns floor_multiplier", () => {
		expect(getIntegrityMultiplier(0.2, defaultConfig)).toBe(0.5);
		expect(getIntegrityMultiplier(0.0, defaultConfig)).toBe(0.5);
	});
});

describe("deriveRank", () => {
	test("returns Unranked when placement not done", () => {
		expect(deriveRank(1500, false, defaultConfig)).toBe("Unranked");
	});

	test("returns correct rank for placed player", () => {
		expect(deriveRank(1500, true, defaultConfig)).toBe("Platinum");
		expect(deriveRank(2100, true, defaultConfig)).toBe("Champion");
		expect(deriveRank(500, true, defaultConfig)).toBe("Bronze");
		expect(deriveRank(1000, true, defaultConfig)).toBe("Silver");
	});
});

describe("calculateElo", () => {
	test("equal players, winner gets positive delta", () => {
		const result = calculateElo({
			winnerElo: 1000,
			loserElo: 1000,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.5,
			integrityScore: 1.0,
			config: defaultConfig,
		});
		expect(result.winnerDelta).toBeGreaterThan(0);
		expect(result.loserDelta).toBeLessThan(0);
	});

	test("upset win gives larger reward", () => {
		const upset = calculateElo({
			winnerElo: 1000,
			loserElo: 1400,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.5,
			integrityScore: 1.0,
			config: defaultConfig,
		});
		const expected = calculateElo({
			winnerElo: 1400,
			loserElo: 1000,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.5,
			integrityScore: 1.0,
			config: defaultConfig,
		});
		expect(upset.winnerDelta).toBeGreaterThan(expected.winnerDelta);
	});

	test("close match reduces deltas", () => {
		const close = calculateElo({
			winnerElo: 1200,
			loserElo: 1200,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.0,
			integrityScore: 1.0,
			config: defaultConfig,
		});
		const normal = calculateElo({
			winnerElo: 1200,
			loserElo: 1200,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.5,
			integrityScore: 1.0,
			config: defaultConfig,
		});
		expect(Math.abs(close.winnerDelta)).toBeLessThan(
			Math.abs(normal.winnerDelta),
		);
	});

	test("low integrity reduces deltas", () => {
		const degraded = calculateElo({
			winnerElo: 1200,
			loserElo: 1200,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.5,
			integrityScore: 0.5,
			config: defaultConfig,
		});
		const clean = calculateElo({
			winnerElo: 1200,
			loserElo: 1200,
			winnerGamesPlayed: 50,
			loserGamesPlayed: 50,
			decisivenessScore: 0.5,
			integrityScore: 1.0,
			config: defaultConfig,
		});
		expect(Math.abs(degraded.winnerDelta)).toBeLessThan(
			Math.abs(clean.winnerDelta),
		);
	});

	test("spec example: 1600 vs 1650 narrow win", () => {
		const result = calculateElo({
			winnerElo: 1600,
			loserElo: 1650,
			winnerGamesPlayed: 150,
			loserGamesPlayed: 150,
			decisivenessScore: 0.15,
			integrityScore: 0.95,
			config: defaultConfig,
		});
		// K=16 (veteran), Expected=0.43, Base=16*(1-0.43)=9.12
		// Decisiveness at 0.15: 0.8 + (0.15/0.5)*(1.0-0.8) = 0.86
		// Integrity at 0.95: stepped → 0.85 (above minor_threshold 0.7)
		// Final: 9.12 * 0.86 * 0.85 = 6.66 → rounds to 7
		expect(result.winnerDelta).toBe(7);
		expect(result.loserDelta).toBe(-7);
	});
});
