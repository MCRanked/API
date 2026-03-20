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

export type App = typeof app;
