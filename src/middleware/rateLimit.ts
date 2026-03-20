import { Elysia } from "elysia";

interface RateLimitOptions {
	max: number;
	windowMs: number;
}

export function rateLimiter(options: RateLimitOptions) {
	const store = new Map<string, { count: number; resetAt: number }>();

	return new Elysia({ name: "rate-limiter" })
		.onBeforeHandle({ as: "global" }, ({ set, request }) => {
			const ip =
				request.headers.get("x-forwarded-for")?.split(",")[0] ??
				"unknown";
			const now = Date.now();
			const key = ip;

			let entry = store.get(key);
			if (!entry || now > entry.resetAt) {
				entry = { count: 0, resetAt: now + options.windowMs };
				store.set(key, entry);
			}

			entry.count++;

			set.headers["X-RateLimit-Limit"] = String(options.max);
			set.headers["X-RateLimit-Remaining"] = String(
				Math.max(0, options.max - entry.count),
			);
			set.headers["X-RateLimit-Reset"] = String(
				Math.ceil(entry.resetAt / 1000),
			);

			if (entry.count > options.max) {
				set.status = 429;
				return {
					error: "Too many requests",
					code: "RATE_LIMITED",
					details: {},
				};
			}
		});
}
