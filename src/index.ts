import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";

const app = new Elysia()
	.use(cors())
	.use(
		swagger({
			documentation: {
				info: {
					title: "RankedMC API",
					version: "1.0.0",
					description:
						"Competitive Minecraft PvP platform API",
				},
			},
			path: "/docs",
		}),
	)
	.get("/health", () => ({ status: "ok" }))
	.listen(Number(process.env.PORT) || 3000);

console.log(
	`RankedMC API running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
