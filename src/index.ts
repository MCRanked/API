import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import { authRoutes } from "./modules/auth/routes";
import { usersRoutes } from "./modules/users/routes";
import { kitsRoutes } from "./modules/kits/routes";
import { seasonsRoutes } from "./modules/seasons/routes";
import { ratingsRoutes } from "./modules/ratings/routes";
import { matchesRoutes } from "./modules/matches/routes";
import { punishmentsRoutes } from "./modules/punishments/routes";
import { internalRoutes } from "./modules/internal/routes";
import { rateLimiter } from "./middleware/rateLimit";
import { runDecay } from "./lib/decay";

const app = new Elysia()
	.use(errorHandler)
	.use(cors())
	.use(
		swagger({
			documentation: {
				info: {
					title: "RankedMC API",
					version: "1.0.0",
					description: "Competitive Minecraft PvP platform API",
				},
			},
			path: "/docs",
			exclude: ["/internal/v1/*"],
		}),
	)
	.get("/health", () => ({ status: "ok" }))
	// Public API
	.group("/api/v1", (app) =>
		app
			.use(rateLimiter({ max: 60, windowMs: 60000 }))
			.use(authRoutes)
			.use(usersRoutes)
			.use(kitsRoutes)
			.use(seasonsRoutes)
			.use(ratingsRoutes)
			.use(matchesRoutes)
			.use(punishmentsRoutes),
	)
	// Internal API
	.use(internalRoutes)
	.listen(config.port);

console.log(
	`RankedMC API running at ${app.server?.hostname}:${app.server?.port}`,
);

// Run decay daily at 00:00 UTC
// Bun doesn't have native cron, use setInterval for MVP
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(async () => {
	try {
		await runDecay();
	} catch (err) {
		console.error("Decay job failed:", err);
	}
}, TWENTY_FOUR_HOURS);

// Also run on startup to catch up
runDecay().catch((err) => console.error("Initial decay run failed:", err));

export type App = typeof app;
