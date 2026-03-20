export interface SeasonConfig {
	elo: {
		default_rating: number;
		base_divisor: number;
		k_factors: {
			placement: { max_games: number; k: number };
			established: { max_games: number; k: number };
			veteran: { k: number };
		};
		decisiveness: {
			min_multiplier: number;
			mid_multiplier: number;
			max_multiplier: number;
		};
		integrity: {
			perfect: number;
			minor_threshold: number;
			minor_multiplier: number;
			degraded_threshold: number;
			degraded_multiplier: number;
			floor_multiplier: number;
		};
		placement_matches: number;
	};
	ranks: Array<{
		name: string;
		min_elo: number | null;
		placement_required?: boolean;
	}>;
	decay: {
		enabled: boolean;
		min_elo: number;
		inactivity_days: number;
		points_per_day: number;
		floor_elo: number;
	};
}

export function getKFactor(gamesPlayed: number, config: SeasonConfig): number {
	const { placement, established, veteran } = config.elo.k_factors;
	if (gamesPlayed < placement.max_games) return placement.k;
	if (gamesPlayed < established.max_games) return established.k;
	return veteran.k;
}

export function getDecisivenessMultiplier(
	score: number,
	config: SeasonConfig,
): number {
	const { min_multiplier, mid_multiplier, max_multiplier } =
		config.elo.decisiveness;

	if (score <= 0.5) {
		const t = score / 0.5;
		return min_multiplier + t * (mid_multiplier - min_multiplier);
	}
	const t = (score - 0.5) / 0.5;
	return mid_multiplier + t * (max_multiplier - mid_multiplier);
}

export function getIntegrityMultiplier(
	score: number,
	config: SeasonConfig,
): number {
	const {
		perfect,
		minor_threshold,
		minor_multiplier,
		degraded_threshold,
		degraded_multiplier,
		floor_multiplier,
	} = config.elo.integrity;

	// Strict stepped thresholds (not interpolated)
	if (score >= perfect) return 1.0;
	if (score >= minor_threshold) return minor_multiplier;
	if (score >= degraded_threshold) return degraded_multiplier;
	return floor_multiplier;
}

export function deriveRank(
	elo: number,
	placementDone: boolean,
	config: SeasonConfig,
): string {
	if (!placementDone) return "Unranked";

	const ranked = config.ranks
		.filter((r) => r.min_elo !== null)
		.sort((a, b) => (b.min_elo as number) - (a.min_elo as number));

	for (const tier of ranked) {
		if (elo >= (tier.min_elo as number)) {
			return tier.name;
		}
	}

	return config.ranks[0]?.name ?? "Unranked";
}

interface EloInput {
	winnerElo: number;
	loserElo: number;
	winnerGamesPlayed: number;
	loserGamesPlayed: number;
	decisivenessScore: number;
	integrityScore: number;
	config: SeasonConfig;
}

interface EloResult {
	winnerDelta: number;
	loserDelta: number;
	winnerNewElo: number;
	loserNewElo: number;
}

export function calculateElo(input: EloInput): EloResult {
	const {
		winnerElo,
		loserElo,
		winnerGamesPlayed,
		loserGamesPlayed,
		decisivenessScore,
		integrityScore,
		config,
	} = input;

	const divisor = config.elo.base_divisor;

	// Expected scores
	const winnerExpected = 1 / (1 + 10 ** ((loserElo - winnerElo) / divisor));
	const loserExpected = 1 / (1 + 10 ** ((winnerElo - loserElo) / divisor));

	// K factors (can differ per player)
	const winnerK = getKFactor(winnerGamesPlayed, config);
	const loserK = getKFactor(loserGamesPlayed, config);

	// Base deltas
	const winnerBase = winnerK * (1.0 - winnerExpected);
	const loserBase = loserK * (0.0 - loserExpected);

	// Multipliers
	const decisiveness = getDecisivenessMultiplier(decisivenessScore, config);
	const integrity = getIntegrityMultiplier(integrityScore, config);

	// Final deltas
	const winnerDelta = Math.round(winnerBase * decisiveness * integrity);
	const loserDelta = Math.round(loserBase * decisiveness * integrity);

	return {
		winnerDelta,
		loserDelta,
		winnerNewElo: winnerElo + winnerDelta,
		loserNewElo: loserElo + loserDelta,
	};
}
