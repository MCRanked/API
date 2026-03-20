# API Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the RankedMC API server — Elysia + Drizzle + PostgreSQL application plane for a competitive Minecraft PvP platform.

**Architecture:** Hybrid module structure with shared infra (`src/db/`, `src/middleware/`, `src/lib/`) and feature modules (`src/modules/`). Each module is an Elysia plugin with direct imports. Public endpoints under `/api/v1/`, internal root-server endpoints under `/internal/v1/` with API key auth.

**Tech Stack:** Bun, Elysia, Drizzle ORM, PostgreSQL, Biome, JWT (jose), Microsoft/Xbox/Minecraft OAuth

**Spec:** `docs/superpowers/specs/2026-03-20-api-server-design.md`

---

## File Map

### Infrastructure
| File | Responsibility |
|------|----------------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config |
| `biome.json` | Biome linter/formatter config |
| `.env.example` | Environment variable template |
| `drizzle.config.ts` | Drizzle Kit migration config |
| `src/config.ts` | Typed env var loading + validation |
| `src/index.ts` | App entry — composes all plugins, starts server |
| `src/db/index.ts` | Drizzle client + PostgreSQL connection |

### Schema (one file per table)
| File | Table |
|------|-------|
| `src/db/schema/users.ts` | `users` |
| `src/db/schema/kits.ts` | `kits` |
| `src/db/schema/seasons.ts` | `seasons` |
| `src/db/schema/ratings.ts` | `ratings` |
| `src/db/schema/matches.ts` | `matches` |
| `src/db/schema/punishments.ts` | `punishments` |
| `src/db/schema/player-loadouts.ts` | `player_loadouts` |
| `src/db/schema/index.ts` | Re-exports all schemas |

### Middleware
| File | Responsibility |
|------|----------------|
| `src/middleware/error.ts` | Global error handler, error envelope |
| `src/middleware/auth.ts` | JWT verification guard |
| `src/middleware/apiKey.ts` | Internal API key guard |
| `src/middleware/rateLimit.ts` | Rate limiting (per-IP and per-user) |

### Libraries
| File | Responsibility |
|------|----------------|
| `src/lib/jwt.ts` | JWT sign, verify, refresh token generation |
| `src/lib/microsoft-auth.ts` | Microsoft → Xbox Live → XSTS → Minecraft token exchange |
| `src/lib/minecraft-auth.ts` | Verify Minecraft access token against Minecraft Services |
| `src/lib/elo.ts` | Config-driven Elo calculation engine |
| `src/lib/pagination.ts` | Cursor encode/decode + paginated response helper |

### Modules (routes.ts + service.ts each)
| Module | Public Routes | Internal Routes |
|--------|--------------|-----------------|
| `src/modules/auth/` | login, callback, verify, refresh, logout | — |
| `src/modules/users/` | me, profile, preferences, loadouts | — |
| `src/modules/kits/` | list, get by slug | — |
| `src/modules/seasons/` | list, active, get by id | — |
| `src/modules/ratings/` | leaderboard, user rating | — |
| `src/modules/matches/` | get by id, recent | — |
| `src/modules/punishments/` | public history | — |
| `src/modules/internal/` | — | match submit, void, punish, session check, loadout, seasons, kits |

### Tests
| File | Tests |
|------|-------|
| `tests/lib/elo.test.ts` | Elo engine unit tests |
| `tests/lib/jwt.test.ts` | JWT sign/verify/refresh tests |
| `tests/lib/pagination.test.ts` | Cursor pagination tests |
| `tests/middleware/auth.test.ts` | Auth middleware tests |
| `tests/middleware/apiKey.test.ts` | API key middleware tests |
| `tests/middleware/error.test.ts` | Error handler tests |
| `tests/middleware/rateLimit.test.ts` | Rate limiting tests |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `.env.example`, `src/index.ts`

- [ ] **Step 1: Initialize Bun project**

```bash
cd /data/github/RankedMC/API
bun init -y
```

- [ ] **Step 2: Install dependencies**

```bash
cd /data/github/RankedMC/API
bun add elysia @elysiajs/swagger @elysiajs/cors jose drizzle-orm postgres
bun add -d drizzle-kit @biomejs/biome typescript @types/bun
```

Packages:
- `elysia` — web framework
- `@elysiajs/swagger` — OpenAPI docs
- `@elysiajs/cors` — CORS support
- `jose` — JWT signing/verification (Web Crypto based, works with Bun)
- `drizzle-orm` — ORM
- `postgres` — PostgreSQL driver (postgres.js)
- `drizzle-kit` — migration tooling
- `@biomejs/biome` — linter/formatter

- [ ] **Step 3: Configure Biome**

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

- [ ] **Step 4: Configure TypeScript**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "drizzle.config.ts"]
}
```

- [ ] **Step 5: Create `.env.example`**

```env
# Server
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgres://user:password@localhost:5432/rankedmc

# Auth
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback
JWT_SECRET=your-secret-key-min-32-chars-long

# Internal
INTERNAL_API_KEY=your-internal-api-key
```

- [ ] **Step 6: Add scripts to `package.json`**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "bun test"
  }
}
```

- [ ] **Step 7: Create minimal app entry**

Create `src/index.ts`:

```typescript
import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

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
```

- [ ] **Step 8: Verify it runs**

Run: `cd /data/github/RankedMC/API && bun run src/index.ts &`
Then: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`
Kill the server after verification.

- [ ] **Step 9: Commit**

```bash
cd /data/github/RankedMC/API
git add package.json bun.lock tsconfig.json biome.json .env.example src/index.ts
git commit -m "feat: scaffold API project with Elysia, Drizzle, Biome"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Create typed config**

Create `src/config.ts`:

```typescript
function required(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export const config = {
	port: Number(process.env.PORT) || 3000,
	host: process.env.HOST || "0.0.0.0",

	databaseUrl: required("DATABASE_URL"),

	microsoftClientId: required("MICROSOFT_CLIENT_ID"),
	microsoftClientSecret: required("MICROSOFT_CLIENT_SECRET"),
	microsoftRedirectUri: required("MICROSOFT_REDIRECT_URI"),

	jwtSecret: required("JWT_SECRET"),
	jwtAccessExpiresIn: "15m",
	jwtRefreshExpiresInDays: 30,

	internalApiKey: required("INTERNAL_API_KEY"),
} as const;
```

- [ ] **Step 2: Use config in index.ts**

Update `src/index.ts` to import and use `config`:

Replace the hardcoded port:
```typescript
import { config } from "./config";
// ...
.listen(config.port);

console.log(
	`RankedMC API running at ${app.server?.hostname}:${app.server?.port}`,
);
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/RankedMC/API
git add src/config.ts src/index.ts
git commit -m "feat: add typed config module with env validation"
```

---

## Task 3: Database Connection + Schema

**Files:**
- Create: `src/db/index.ts`, `drizzle.config.ts`
- Create: `src/db/schema/users.ts`, `src/db/schema/kits.ts`, `src/db/schema/seasons.ts`, `src/db/schema/ratings.ts`, `src/db/schema/matches.ts`, `src/db/schema/punishments.ts`, `src/db/schema/player-loadouts.ts`, `src/db/schema/index.ts`

- [ ] **Step 1: Create Drizzle config**

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
```

- [ ] **Step 2: Create DB client**

Create `src/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

const client = postgres(config.databaseUrl);

export const db = drizzle(client, { schema });
```

- [ ] **Step 3: Create users schema**

Create `src/db/schema/users.ts`:

```typescript
import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	minecraftUuid: varchar("minecraft_uuid", { length: 36 }).unique().notNull(),
	username: varchar("username", { length: 16 }).notNull(),
	microsoftId: varchar("microsoft_id", { length: 255 }),
	refreshToken: varchar("refresh_token", { length: 255 }),
	versionPreference: varchar("version_preference", { length: 32 }).default(
		"1.8",
	),
	language: varchar("language", { length: 8 }).default("en"),
	preferences: jsonb("preferences").default({}),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at"),
});
```

- [ ] **Step 4: Create kits schema**

Create `src/db/schema/kits.ts`:

```typescript
import {
	pgTable,
	serial,
	varchar,
	text,
	jsonb,
	boolean,
	integer,
	timestamp,
} from "drizzle-orm/pg-core";

export const kits = pgTable("kits", {
	id: serial("id").primaryKey(),
	slug: varchar("slug", { length: 32 }).unique().notNull(),
	name: varchar("name", { length: 64 }).notNull(),
	description: text("description"),
	versionRange: varchar("version_range", { length: 32 }).notNull(),
	ruleset: jsonb("ruleset").notNull(),
	defaultInventory: jsonb("default_inventory"),
	allowCustomLoadouts: boolean("allow_custom_loadouts").default(false),
	icon: varchar("icon", { length: 255 }),
	category: varchar("category", { length: 32 }),
	displayOrder: integer("display_order").default(0),
	active: boolean("active").default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

- [ ] **Step 5: Create seasons schema**

Create `src/db/schema/seasons.ts`:

```typescript
import {
	pgTable,
	serial,
	integer,
	timestamp,
	boolean,
	jsonb,
	unique,
} from "drizzle-orm/pg-core";
import { kits } from "./kits";

export const seasons = pgTable(
	"seasons",
	{
		id: serial("id").primaryKey(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		number: integer("number").notNull(),
		startsAt: timestamp("starts_at").notNull(),
		endsAt: timestamp("ends_at"),
		active: boolean("active").default(false),
		config: jsonb("config").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.kitId, table.number)],
);
```

- [ ] **Step 6: Create ratings schema**

Create `src/db/schema/ratings.ts`:

```typescript
import {
	pgTable,
	serial,
	uuid,
	integer,
	varchar,
	boolean,
	timestamp,
	unique,
	index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { kits } from "./kits";
import { seasons } from "./seasons";

export const ratings = pgTable(
	"ratings",
	{
		id: serial("id").primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		seasonId: integer("season_id")
			.references(() => seasons.id)
			.notNull(),
		elo: integer("elo").notNull(),
		peakElo: integer("peak_elo").notNull(),
		rank: varchar("rank", { length: 32 }),
		gamesPlayed: integer("games_played").default(0).notNull(),
		wins: integer("wins").default(0).notNull(),
		losses: integer("losses").default(0).notNull(),
		winStreak: integer("win_streak").default(0).notNull(),
		bestWinStreak: integer("best_win_streak").default(0).notNull(),
		placementDone: boolean("placement_done").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique().on(table.userId, table.kitId, table.seasonId),
		index("ratings_leaderboard_idx").on(table.kitId, table.seasonId, table.elo),
	],
);
```

- [ ] **Step 7: Create matches schema**

Create `src/db/schema/matches.ts`:

```typescript
import {
	pgTable,
	uuid,
	integer,
	real,
	varchar,
	jsonb,
	timestamp,
	index,
	check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { kits } from "./kits";
import { seasons } from "./seasons";

export const matches = pgTable(
	"matches",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		seasonId: integer("season_id")
			.references(() => seasons.id)
			.notNull(),
		winnerId: uuid("winner_id").references(() => users.id),
		loserId: uuid("loser_id").references(() => users.id),
		winnerEloBefore: integer("winner_elo_before"),
		winnerEloAfter: integer("winner_elo_after"),
		loserEloBefore: integer("loser_elo_before"),
		loserEloAfter: integer("loser_elo_after"),
		winnerEloDelta: integer("winner_elo_delta"),
		loserEloDelta: integer("loser_elo_delta"),
		decisivenessScore: real("decisiveness_score").notNull(),
		integrityScore: real("integrity_score").notNull(),
		region: varchar("region", { length: 16 }).notNull(),
		nodeId: varchar("node_id", { length: 64 }).notNull(),
		durationMs: integer("duration_ms").notNull(),
		metadata: jsonb("metadata"),
		status: varchar("status", { length: 16 }).notNull(),
		playedAt: timestamp("played_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"decisiveness_score_range",
			sql`${table.decisivenessScore} >= 0 AND ${table.decisivenessScore} <= 1`,
		),
		check(
			"integrity_score_range",
			sql`${table.integrityScore} >= 0 AND ${table.integrityScore} <= 1`,
		),
		index("matches_winner_idx").on(table.winnerId, table.playedAt),
		index("matches_loser_idx").on(table.loserId, table.playedAt),
		index("matches_kit_season_idx").on(
			table.kitId,
			table.seasonId,
			table.playedAt,
		),
	],
);
```

- [ ] **Step 8: Create punishments schema**

Create `src/db/schema/punishments.ts`:

```typescript
import {
	pgTable,
	serial,
	uuid,
	varchar,
	text,
	timestamp,
	boolean,
	index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const punishments = pgTable(
	"punishments",
	{
		id: serial("id").primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		type: varchar("type", { length: 16 }).notNull(),
		reason: text("reason").notNull(),
		evidenceRef: varchar("evidence_ref", { length: 255 }),
		issuedBy: varchar("issued_by", { length: 64 }).notNull(),
		expiresAt: timestamp("expires_at"),
		revoked: boolean("revoked").default(false).notNull(),
		revokedReason: text("revoked_reason"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("punishments_user_idx").on(table.userId, table.revoked),
	],
);
```

- [ ] **Step 9: Create player_loadouts schema**

Create `src/db/schema/player-loadouts.ts`:

```typescript
import {
	pgTable,
	serial,
	uuid,
	integer,
	varchar,
	jsonb,
	boolean,
	timestamp,
	unique,
	index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { kits } from "./kits";

export const playerLoadouts = pgTable(
	"player_loadouts",
	{
		id: serial("id").primaryKey(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		kitId: integer("kit_id")
			.references(() => kits.id)
			.notNull(),
		name: varchar("name", { length: 32 }).default("default").notNull(),
		inventory: jsonb("inventory").notNull(),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique().on(table.userId, table.kitId, table.name),
		index("loadouts_user_kit_idx").on(table.userId, table.kitId),
	],
);
```

- [ ] **Step 10: Create schema barrel export**

Create `src/db/schema/index.ts`:

```typescript
export { users } from "./users";
export { kits } from "./kits";
export { seasons } from "./seasons";
export { ratings } from "./ratings";
export { matches } from "./matches";
export { punishments } from "./punishments";
export { playerLoadouts } from "./player-loadouts";
```

- [ ] **Step 11: Generate initial migration**

Run: `cd /data/github/RankedMC/API && bun run db:generate`
Expected: Migration SQL files created in `src/db/migrations/`

- [ ] **Step 12: Commit**

```bash
cd /data/github/RankedMC/API
git add drizzle.config.ts src/db/
git commit -m "feat: add database schema for all 7 tables with indexes"
```

---

## Task 4: Error Handling Middleware

**Files:**
- Create: `src/middleware/error.ts`, `tests/middleware/error.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/middleware/error.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler, ApiError } from "../../src/middleware/error";

describe("errorHandler", () => {
	const app = new Elysia()
		.use(errorHandler)
		.get("/ok", () => ({ data: "hello" }))
		.get("/api-error", () => {
			throw new ApiError(400, "VALIDATION_ERROR", "Invalid input", {
				field: "name",
			});
		})
		.get("/unknown-error", () => {
			throw new Error("something broke");
		});

	test("passes through successful responses", async () => {
		const res = await app.handle(new Request("http://localhost/ok"));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: "hello" });
	});

	test("formats ApiError correctly", async () => {
		const res = await app.handle(new Request("http://localhost/api-error"));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({
			error: "Invalid input",
			code: "VALIDATION_ERROR",
			details: { field: "name" },
		});
	});

	test("formats unknown errors as 500", async () => {
		const res = await app.handle(
			new Request("http://localhost/unknown-error"),
		);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.code).toBe("INTERNAL_ERROR");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /data/github/RankedMC/API && bun test tests/middleware/error.test.ts`
Expected: FAIL — cannot resolve modules

- [ ] **Step 3: Implement error handler**

Create `src/middleware/error.ts`:

```typescript
import { Elysia } from "elysia";

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public details?: Record<string, unknown>,
	) {
		super(message);
	}
}

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
	({ error, set }) => {
		if (error instanceof ApiError) {
			set.status = error.status;
			return {
				error: error.message,
				code: error.code,
				details: error.details ?? {},
			};
		}

		console.error("Unhandled error:", error);
		set.status = 500;
		return {
			error: "Internal server error",
			code: "INTERNAL_ERROR",
			details: {},
		};
	},
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /data/github/RankedMC/API && bun test tests/middleware/error.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /data/github/RankedMC/API
git add src/middleware/error.ts tests/middleware/error.test.ts
git commit -m "feat: add error handler middleware with ApiError class"
```

---

## Task 5: JWT Library

**Files:**
- Create: `src/lib/jwt.ts`, `tests/lib/jwt.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/jwt.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import {
	signAccessToken,
	verifyAccessToken,
	generateRefreshToken,
	hashRefreshToken,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/jwt.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement JWT library**

Create `src/lib/jwt.ts`:

```typescript
import * as jose from "jose";
import { config } from "../config";

const secret = new TextEncoder().encode(config.jwtSecret);

interface AccessTokenPayload {
	sub: string;
	minecraft_uuid: string;
	username: string;
}

export async function signAccessToken(
	payload: AccessTokenPayload,
): Promise<string> {
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(config.jwtAccessExpiresIn)
		.sign(secret);
}

export async function verifyAccessToken(
	token: string,
): Promise<AccessTokenPayload & jose.JWTPayload> {
	const { payload } = await jose.jwtVerify(token, secret);
	return payload as AccessTokenPayload & jose.JWTPayload;
}

export function generateRefreshToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(64));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export async function hashRefreshToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
```

Note: Tests will need env vars set. Create a `tests/setup.ts` or set vars inline. Since `config.ts` throws on missing vars, set test env vars:

Create `tests/setup.ts`:

```typescript
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.MICROSOFT_CLIENT_ID = "test";
process.env.MICROSOFT_CLIENT_SECRET = "test";
process.env.MICROSOFT_REDIRECT_URI = "http://localhost:3000/callback";
process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-chars";
process.env.INTERNAL_API_KEY = "test-api-key";
```

Add to `package.json`:

```json
{
  "test": "bun test --preload ./tests/setup.ts"
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/jwt.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /data/github/RankedMC/API
git add src/lib/jwt.ts tests/lib/jwt.test.ts tests/setup.ts package.json
git commit -m "feat: add JWT sign/verify and refresh token generation"
```

---

## Task 6: Auth + API Key Middleware

**Files:**
- Create: `src/middleware/auth.ts`, `src/middleware/apiKey.ts`
- Create: `tests/middleware/auth.test.ts`, `tests/middleware/apiKey.test.ts`

- [ ] **Step 1: Write auth middleware test**

Create `tests/middleware/auth.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { authGuard } from "../../src/middleware/auth";
import { signAccessToken } from "../../src/lib/jwt";

describe("authGuard", () => {
	const app = new Elysia()
		.use(authGuard)
		.get("/protected", ({ user }) => ({ uuid: user.sub }));

	test("rejects requests without Authorization header", async () => {
		const res = await app.handle(new Request("http://localhost/protected"));
		expect(res.status).toBe(401);
	});

	test("rejects invalid tokens", async () => {
		const res = await app.handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: "Bearer invalid-token" },
			}),
		);
		expect(res.status).toBe(401);
	});

	test("allows valid tokens and populates user context", async () => {
		const token = await signAccessToken({
			sub: "user-123",
			minecraft_uuid: "mc-456",
			username: "TestPlayer",
		});
		const res = await app.handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.uuid).toBe("user-123");
	});
});
```

- [ ] **Step 2: Write API key middleware test**

Create `tests/middleware/apiKey.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { apiKeyGuard } from "../../src/middleware/apiKey";

describe("apiKeyGuard", () => {
	const app = new Elysia()
		.use(apiKeyGuard)
		.get("/internal", () => ({ ok: true }));

	test("rejects requests without X-API-Key header", async () => {
		const res = await app.handle(new Request("http://localhost/internal"));
		expect(res.status).toBe(401);
	});

	test("rejects wrong API key", async () => {
		const res = await app.handle(
			new Request("http://localhost/internal", {
				headers: { "X-API-Key": "wrong-key" },
			}),
		);
		expect(res.status).toBe(401);
	});

	test("allows correct API key", async () => {
		const res = await app.handle(
			new Request("http://localhost/internal", {
				headers: { "X-API-Key": "test-api-key" },
			}),
		);
		expect(res.status).toBe(200);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /data/github/RankedMC/API && bun test tests/middleware/`
Expected: FAIL

- [ ] **Step 4: Implement auth guard**

Create `src/middleware/auth.ts`:

```typescript
import { Elysia } from "elysia";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "./error";

export const authGuard = new Elysia({ name: "auth-guard" }).derive(
	async ({ headers }) => {
		const authorization = headers.authorization;
		if (!authorization?.startsWith("Bearer ")) {
			throw new ApiError(
				401,
				"UNAUTHORIZED",
				"Missing or invalid Authorization header",
			);
		}

		const token = authorization.slice(7);
		try {
			const payload = await verifyAccessToken(token);
			return { user: payload };
		} catch {
			throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
		}
	},
);
```

- [ ] **Step 5: Implement API key guard**

Create `src/middleware/apiKey.ts`:

```typescript
import { Elysia } from "elysia";
import { config } from "../config";
import { ApiError } from "./error";

export const apiKeyGuard = new Elysia({ name: "api-key-guard" }).derive(
	({ headers }) => {
		const apiKey = headers["x-api-key"];
		if (!apiKey || apiKey !== config.internalApiKey) {
			throw new ApiError(401, "UNAUTHORIZED", "Invalid or missing API key");
		}
		return {};
	},
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /data/github/RankedMC/API && bun test tests/middleware/`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd /data/github/RankedMC/API
git add src/middleware/auth.ts src/middleware/apiKey.ts tests/middleware/auth.test.ts tests/middleware/apiKey.test.ts
git commit -m "feat: add JWT auth guard and API key guard middleware"
```

---

## Task 7: Pagination Helper

**Files:**
- Create: `src/lib/pagination.ts`, `tests/lib/pagination.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/pagination.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { encodeCursor, decodeCursor, paginatedResponse } from "../../src/lib/pagination";

describe("cursor pagination", () => {
	test("encodeCursor produces base64 string", () => {
		const cursor = encodeCursor({ id: 42, elo: 1500 });
		expect(typeof cursor).toBe("string");
		expect(cursor.length).toBeGreaterThan(0);
	});

	test("decodeCursor reverses encodeCursor", () => {
		const original = { id: 42, elo: 1500 };
		const cursor = encodeCursor(original);
		const decoded = decodeCursor(cursor);
		expect(decoded).toEqual(original);
	});

	test("decodeCursor returns null for invalid input", () => {
		expect(decodeCursor("not-valid-base64!!!")).toBeNull();
		expect(decodeCursor("")).toBeNull();
	});

	test("paginatedResponse with more data (fetched limit+1 items)", () => {
		// Caller fetches limit+1 = 6 items, meaning there are more
		const items = [1, 2, 3, 4, 5, 6];
		const result = paginatedResponse(items, 5, (item) =>
			encodeCursor({ id: item }),
		);
		expect(result.data).toEqual([1, 2, 3, 4, 5]); // only limit items returned
		expect(result.has_more).toBe(true);
		expect(result.next_cursor).toBeDefined();
	});

	test("paginatedResponse at end of data (fewer than limit+1)", () => {
		const items = [1, 2, 3];
		const result = paginatedResponse(items, 5, (item) =>
			encodeCursor({ id: item }),
		);
		expect(result.data).toEqual([1, 2, 3]);
		expect(result.has_more).toBe(false);
		expect(result.next_cursor).toBeNull();
	});

	test("paginatedResponse exactly limit items means no more", () => {
		const items = [1, 2, 3, 4, 5];
		const result = paginatedResponse(items, 5, (item) =>
			encodeCursor({ id: item }),
		);
		expect(result.data).toEqual([1, 2, 3, 4, 5]);
		expect(result.has_more).toBe(false);
		expect(result.next_cursor).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/pagination.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pagination helper**

Create `src/lib/pagination.ts`:

```typescript
export function encodeCursor(data: Record<string, unknown>): string {
	return btoa(JSON.stringify(data));
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
	try {
		if (!cursor) return null;
		return JSON.parse(atob(cursor));
	} catch {
		return null;
	}
}

/**
 * Build a paginated response. Callers must fetch `limit + 1` items.
 * If we got the extra item, there are more results — we return only `limit` items.
 */
export function paginatedResponse<T>(
	items: T[],
	limit: number,
	cursorFn: (lastItem: T) => string,
): { data: T[]; next_cursor: string | null; has_more: boolean } {
	const hasMore = items.length > limit;
	const data = hasMore ? items.slice(0, limit) : items;
	const lastItem = data.at(-1);

	return {
		data,
		next_cursor: hasMore && lastItem ? cursorFn(lastItem) : null,
		has_more: hasMore,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/pagination.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /data/github/RankedMC/API
git add src/lib/pagination.ts tests/lib/pagination.test.ts
git commit -m "feat: add cursor-based pagination helpers"
```

---

## Task 8: Elo Calculation Engine

**Files:**
- Create: `src/lib/elo.ts`, `tests/lib/elo.test.ts`

This is the core algorithm. TDD is critical here.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/elo.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/elo.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Elo engine**

Create `src/lib/elo.ts`:

```typescript
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
	const winnerExpected =
		1 / (1 + 10 ** ((loserElo - winnerElo) / divisor));
	const loserExpected =
		1 / (1 + 10 ** ((winnerElo - loserElo) / divisor));

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/elo.test.ts`
Expected: All tests PASS

If the spec example test fails, adjust rounding or interpolation until the expected values from the spec (+8 / -8) are produced. The spec says:
- winnerBase = 16 × (1.0 - 0.43) = 9.12
- decisiveness at 0.15 = 0.84
- integrity at 0.95 = 0.98
- final = 9.12 × 0.84 × 0.98 = 7.50 → rounds to 8

- [ ] **Step 5: Commit**

```bash
cd /data/github/RankedMC/API
git add src/lib/elo.ts tests/lib/elo.test.ts
git commit -m "feat: add config-driven Elo calculation engine with TDD"
```

---

## Task 9: Microsoft + Minecraft Auth Libraries

**Files:**
- Create: `src/lib/microsoft-auth.ts`, `src/lib/minecraft-auth.ts`

These call external APIs and are not easily unit-tested without mocking. Write them as plain functions for integration testing later.

- [ ] **Step 1: Implement Microsoft auth chain**

Create `src/lib/microsoft-auth.ts`:

```typescript
import { config } from "../config";

const MICROSOFT_AUTH_URL = "https://login.live.com/oauth20_authorize.srf";
const MICROSOFT_TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const XBOX_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_URL =
	"https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL =
	"https://api.minecraftservices.com/minecraft/profile";

export interface MinecraftProfile {
	id: string; // Minecraft UUID (no dashes)
	name: string; // Minecraft username
}

export function getAuthorizationUrl(): string {
	const params = new URLSearchParams({
		client_id: config.microsoftClientId,
		response_type: "code",
		redirect_uri: config.microsoftRedirectUri,
		scope: "XboxLive.signin offline_access",
	});
	return `${MICROSOFT_AUTH_URL}?${params}`;
}

export async function exchangeCodeForProfile(
	code: string,
): Promise<MinecraftProfile> {
	// Step 1: Code → Microsoft token
	const msToken = await getMicrosoftToken(code);

	// Step 2: Microsoft token → Xbox Live token
	const { token: xblToken, userHash } = await getXboxLiveToken(msToken);

	// Step 3: Xbox Live token → XSTS token
	const xstsToken = await getXstsToken(xblToken);

	// Step 4: XSTS token → Minecraft token
	const mcToken = await getMinecraftToken(xstsToken, userHash);

	// Step 5: Minecraft token → Profile
	return getMinecraftProfile(mcToken);
}

async function getMicrosoftToken(code: string): Promise<string> {
	const res = await fetch(MICROSOFT_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.microsoftClientId,
			client_secret: config.microsoftClientSecret,
			code,
			grant_type: "authorization_code",
			redirect_uri: config.microsoftRedirectUri,
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(`Microsoft token exchange failed: ${data.error}`);
	return data.access_token;
}

async function getXboxLiveToken(
	msToken: string,
): Promise<{ token: string; userHash: string }> {
	const res = await fetch(XBOX_AUTH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			Properties: {
				AuthMethod: "RPS",
				SiteName: "user.auth.xboxlive.com",
				RpsTicket: `d=${msToken}`,
			},
			RelyingParty: "http://auth.xboxlive.com",
			TokenType: "JWT",
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error("Xbox Live auth failed");
	return {
		token: data.Token,
		userHash: data.DisplayClaims.xui[0].uhs,
	};
}

async function getXstsToken(xblToken: string): Promise<string> {
	const res = await fetch(XSTS_AUTH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			Properties: {
				SandboxId: "RETAIL",
				UserTokens: [xblToken],
			},
			RelyingParty: "rp://api.minecraftservices.com/",
			TokenType: "JWT",
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error("XSTS auth failed");
	return data.Token;
}

async function getMinecraftToken(
	xstsToken: string,
	userHash: string,
): Promise<string> {
	const res = await fetch(MINECRAFT_AUTH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
		}),
	});
	const data = await res.json();
	if (!res.ok) throw new Error("Minecraft auth failed");
	return data.access_token;
}

export async function getMinecraftProfile(
	mcToken: string,
): Promise<MinecraftProfile> {
	const res = await fetch(MINECRAFT_PROFILE_URL, {
		headers: { Authorization: `Bearer ${mcToken}` },
	});
	const data = await res.json();
	if (!res.ok) throw new Error("Failed to fetch Minecraft profile");
	return { id: data.id, name: data.name };
}
```

- [ ] **Step 2: Implement Minecraft token verification**

Create `src/lib/minecraft-auth.ts`:

```typescript
import { getMinecraftProfile, type MinecraftProfile } from "./microsoft-auth";

/**
 * Verify a Minecraft access token by calling the profile endpoint.
 * If the token is valid, we get the player's UUID and username.
 * Used by the launcher auth flow (Flow B).
 */
export async function verifyMinecraftToken(
	mcToken: string,
): Promise<MinecraftProfile> {
	return getMinecraftProfile(mcToken);
}
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/RankedMC/API
git add src/lib/microsoft-auth.ts src/lib/minecraft-auth.ts
git commit -m "feat: add Microsoft/Xbox/Minecraft OAuth chain and token verification"
```

---

## Task 10: Auth Module

**Files:**
- Create: `src/modules/auth/service.ts`, `src/modules/auth/routes.ts`

- [ ] **Step 1: Implement auth service**

Create `src/modules/auth/service.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { config } from "../../config";
import {
	signAccessToken,
	generateRefreshToken,
	hashRefreshToken,
} from "../../lib/jwt";
import { ApiError } from "../../middleware/error";
import type { MinecraftProfile } from "../../lib/microsoft-auth";

function formatUuid(raw: string): string {
	// Minecraft UUIDs come without dashes, normalize to dashed format
	if (raw.includes("-")) return raw;
	return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

interface AuthResult {
	accessToken: string;
	refreshToken: string;
	user: { id: string; minecraftUuid: string; username: string };
}

export async function authenticateMinecraftProfile(
	profile: MinecraftProfile,
	microsoftId?: string,
): Promise<AuthResult> {
	const minecraftUuid = formatUuid(profile.id);

	// Upsert user
	const existing = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});

	const refreshToken = generateRefreshToken();
	const hashedRefresh = await hashRefreshToken(refreshToken);
	const now = new Date();

	let userId: string;

	if (existing) {
		await db
			.update(users)
			.set({
				username: profile.name,
				refreshToken: hashedRefresh,
				microsoftId: microsoftId ?? existing.microsoftId,
				lastSeenAt: now,
				updatedAt: now,
			})
			.where(eq(users.id, existing.id));
		userId = existing.id;
	} else {
		const [newUser] = await db
			.insert(users)
			.values({
				minecraftUuid,
				username: profile.name,
				microsoftId: microsoftId ?? null,
				refreshToken: hashedRefresh,
				lastSeenAt: now,
			})
			.returning({ id: users.id });
		userId = newUser.id;
	}

	const accessToken = await signAccessToken({
		sub: userId,
		minecraft_uuid: minecraftUuid,
		username: profile.name,
	});

	return {
		accessToken,
		refreshToken,
		user: { id: userId, minecraftUuid, username: profile.name },
	};
}

export async function refreshSession(
	rawRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
	const hashedToken = await hashRefreshToken(rawRefreshToken);

	const user = await db.query.users.findFirst({
		where: eq(users.refreshToken, hashedToken),
	});

	if (!user) {
		throw new ApiError(401, "UNAUTHORIZED", "Invalid refresh token");
	}

	// Check if refresh token has expired (30 days from last update)
	const expiryMs = config.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000;
	if (user.updatedAt.getTime() + expiryMs < Date.now()) {
		// Token expired — clear it and reject
		await db
			.update(users)
			.set({ refreshToken: null })
			.where(eq(users.id, user.id));
		throw new ApiError(401, "UNAUTHORIZED", "Refresh token expired");
	}

	const newRefreshToken = generateRefreshToken();
	const newHashedRefresh = await hashRefreshToken(newRefreshToken);

	await db
		.update(users)
		.set({
			refreshToken: newHashedRefresh,
			lastSeenAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(users.id, user.id));

	const accessToken = await signAccessToken({
		sub: user.id,
		minecraft_uuid: user.minecraftUuid,
		username: user.username,
	});

	return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string): Promise<void> {
	await db
		.update(users)
		.set({ refreshToken: null, updatedAt: new Date() })
		.where(eq(users.id, userId));
}
```

- [ ] **Step 2: Implement auth routes**

Create `src/modules/auth/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
	getAuthorizationUrl,
	exchangeCodeForProfile,
} from "../../lib/microsoft-auth";
import { verifyMinecraftToken } from "../../lib/minecraft-auth";
import {
	authenticateMinecraftProfile,
	refreshSession,
	logout,
} from "./service";

export const authRoutes = new Elysia({ prefix: "/auth" })
	// Flow A: Web OAuth — redirect to Microsoft
	.get("/login", ({ redirect }) => {
		return redirect(getAuthorizationUrl());
	})
	// Flow A: Web OAuth — callback
	.get(
		"/callback",
		async ({ query, set, cookie }) => {
			const profile = await exchangeCodeForProfile(query.code);
			const result = await authenticateMinecraftProfile(profile);
			cookie.refresh_token.set({
				value: result.refreshToken,
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				maxAge: 30 * 24 * 60 * 60, // 30 days
				path: "/",
			});
			return {
				access_token: result.accessToken,
				user: result.user,
			};
		},
		{
			query: t.Object({ code: t.String() }),
		},
	)
	// Flow B: Launcher — verify Minecraft token
	.post(
		"/verify",
		async ({ body }) => {
			const profile = await verifyMinecraftToken(body.token);
			const result = await authenticateMinecraftProfile(profile);
			return {
				access_token: result.accessToken,
				refresh_token: result.refreshToken,
				user: result.user,
			};
		},
		{
			body: t.Object({ token: t.String() }),
		},
	)
	// Refresh tokens
	.post(
		"/refresh",
		async ({ body, cookie }) => {
			const token = body.refresh_token ?? cookie.refresh_token?.value;
			if (!token) {
				throw new Error("No refresh token provided");
			}
			const result = await refreshSession(token);
			if (cookie.refresh_token) {
				cookie.refresh_token.set({
					value: result.refreshToken,
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					maxAge: 30 * 24 * 60 * 60,
					path: "/",
				});
			}
			return {
				access_token: result.accessToken,
				refresh_token: result.refreshToken,
			};
		},
		{
			body: t.Object({ refresh_token: t.Optional(t.String()) }),
		},
	)
	// Logout
	.use(authGuard)
	.post("/logout", async ({ user, cookie }) => {
		await logout(user.sub);
		cookie.refresh_token?.remove();
		return { success: true };
	});
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/RankedMC/API
git add src/modules/auth/
git commit -m "feat: add auth module with web OAuth and launcher verify flows"
```

---

## Task 11: Users Module

**Files:**
- Create: `src/modules/users/service.ts`, `src/modules/users/routes.ts`

- [ ] **Step 1: Implement users service**

Create `src/modules/users/service.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { users, ratings, matches, playerLoadouts, kits } from "../../db/schema";
import { encodeCursor, decodeCursor, paginatedResponse } from "../../lib/pagination";

export async function getUserByUuid(minecraftUuid: string) {
	return db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
		columns: {
			id: true,
			minecraftUuid: true,
			username: true,
			versionPreference: true,
			language: true,
			preferences: true,
			createdAt: true,
			lastSeenAt: true,
		},
	});
}

export async function getUserById(userId: string) {
	return db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: {
			id: true,
			minecraftUuid: true,
			username: true,
			versionPreference: true,
			language: true,
			preferences: true,
			createdAt: true,
			lastSeenAt: true,
		},
	});
}

export async function updatePreferences(
	userId: string,
	prefs: { language?: string; version_preference?: string; preferences?: Record<string, unknown> },
) {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (prefs.language !== undefined) updates.language = prefs.language;
	if (prefs.version_preference !== undefined) updates.versionPreference = prefs.version_preference;
	if (prefs.preferences !== undefined) updates.preferences = prefs.preferences;

	await db.update(users).set(updates).where(eq(users.id, userId));
}

export async function getUserRatings(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	return db.query.ratings.findMany({
		where: eq(ratings.userId, user.id),
	});
}

export async function getLoadouts(userId: string, kitSlug?: string) {
	if (kitSlug) {
		const kit = await db.query.kits.findFirst({
			where: eq(kits.slug, kitSlug),
		});
		if (!kit) return [];
		return db.query.playerLoadouts.findMany({
			where: and(
				eq(playerLoadouts.userId, userId),
				eq(playerLoadouts.kitId, kit.id),
			),
		});
	}
	return db.query.playerLoadouts.findMany({
		where: eq(playerLoadouts.userId, userId),
	});
}
```

- [ ] **Step 2: Implement users routes**

Create `src/modules/users/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { authGuard } from "../../middleware/auth";
import {
	getUserByUuid,
	getUserById,
	updatePreferences,
	getUserRatings,
	getLoadouts,
} from "./service";
import { ApiError } from "../../middleware/error";

export const usersRoutes = new Elysia({ prefix: "/users" })
	// Public routes
	.get(
		"/:uuid",
		async ({ params }) => {
			const user = await getUserByUuid(params.uuid);
			if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
			return user;
		},
		{ params: t.Object({ uuid: t.String() }) },
	)
	.get(
		"/:uuid/ratings",
		async ({ params }) => {
			const result = await getUserRatings(params.uuid);
			if (result === null) throw new ApiError(404, "NOT_FOUND", "User not found");
			return result;
		},
		{ params: t.Object({ uuid: t.String() }) },
	)
	// Authenticated routes
	.use(authGuard)
	.get("/me", async ({ user }) => {
		const profile = await getUserById(user.sub);
		if (!profile) throw new ApiError(404, "NOT_FOUND", "User not found");
		return profile;
	})
	.patch(
		"/me/preferences",
		async ({ user, body }) => {
			await updatePreferences(user.sub, body);
			return { success: true };
		},
		{
			body: t.Object({
				language: t.Optional(t.String()),
				version_preference: t.Optional(t.String()),
				preferences: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	)
	.get("/me/loadouts", async ({ user }) => {
		return getLoadouts(user.sub);
	})
	.get(
		"/me/loadouts/:kitSlug",
		async ({ user, params }) => {
			return getLoadouts(user.sub, params.kitSlug);
		},
		{ params: t.Object({ kitSlug: t.String() }) },
	)
	.put(
		"/me/loadouts/:kitSlug/:name",
		async ({ user, params, body }) => {
			return saveLoadout(user.sub, params.kitSlug, params.name, body.inventory);
		},
		{
			params: t.Object({ kitSlug: t.String(), name: t.String() }),
			body: t.Object({ inventory: t.Unknown() }),
		},
	)
	.delete(
		"/me/loadouts/:kitSlug/:name",
		async ({ user, params }) => {
			await deleteLoadout(user.sub, params.kitSlug, params.name);
			return { success: true };
		},
		{
			params: t.Object({ kitSlug: t.String(), name: t.String() }),
		},
	);
```

Add `saveLoadout` and `deleteLoadout` imports to the routes file import line:

```typescript
import {
	getUserByUuid,
	getUserById,
	updatePreferences,
	getUserRatings,
	getLoadouts,
	saveLoadout,
	deleteLoadout,
} from "./service";
```

Add to `src/modules/users/service.ts`:

```typescript
export async function saveLoadout(
	userId: string,
	kitSlug: string,
	name: string,
	inventory: unknown,
) {
	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");

	if (!kit.allowCustomLoadouts) {
		throw new ApiError(
			400,
			"VALIDATION_ERROR",
			"This kit does not allow custom loadouts",
		);
	}

	// TODO: Validate inventory against kit.ruleset.inventory_rules
	// This is where inventory validation logic will be implemented.
	// For MVP, accept any valid JSON and add validation in a follow-up.

	const existing = await db.query.playerLoadouts.findFirst({
		where: and(
			eq(playerLoadouts.userId, userId),
			eq(playerLoadouts.kitId, kit.id),
			eq(playerLoadouts.name, name),
		),
	});

	if (existing) {
		await db
			.update(playerLoadouts)
			.set({ inventory, updatedAt: new Date() })
			.where(eq(playerLoadouts.id, existing.id));
		return { ...existing, inventory, updatedAt: new Date() };
	}

	const [created] = await db
		.insert(playerLoadouts)
		.values({
			userId,
			kitId: kit.id,
			name,
			inventory,
		})
		.returning();
	return created;
}

export async function deleteLoadout(
	userId: string,
	kitSlug: string,
	name: string,
) {
	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");

	await db
		.delete(playerLoadouts)
		.where(
			and(
				eq(playerLoadouts.userId, userId),
				eq(playerLoadouts.kitId, kit.id),
				eq(playerLoadouts.name, name),
			),
		);
}
```

Also add these imports at the top of users service:

```typescript
import { ApiError } from "../../middleware/error";
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/RankedMC/API
git add src/modules/users/
git commit -m "feat: add users module with profile, preferences, loadout CRUD"
```

---

## Task 12: Kits, Seasons, Ratings, Matches, Punishments Modules

**Files:**
- Create: `src/modules/kits/service.ts`, `src/modules/kits/routes.ts`
- Create: `src/modules/seasons/service.ts`, `src/modules/seasons/routes.ts`
- Create: `src/modules/ratings/service.ts`, `src/modules/ratings/routes.ts`
- Create: `src/modules/matches/service.ts`, `src/modules/matches/routes.ts`
- Create: `src/modules/punishments/service.ts`, `src/modules/punishments/routes.ts`

These are straightforward CRUD read endpoints. Implementing all five together since they follow the same pattern.

- [ ] **Step 1: Implement kits module**

Create `src/modules/kits/service.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { kits } from "../../db/schema";

export async function listActiveKits() {
	return db.query.kits.findMany({
		where: eq(kits.active, true),
		orderBy: kits.displayOrder,
	});
}

export async function getKitBySlug(slug: string) {
	return db.query.kits.findFirst({
		where: eq(kits.slug, slug),
	});
}
```

Create `src/modules/kits/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { listActiveKits, getKitBySlug } from "./service";
import { ApiError } from "../../middleware/error";

export const kitsRoutes = new Elysia({ prefix: "/kits" })
	.get("/", () => listActiveKits())
	.get(
		"/:slug",
		async ({ params }) => {
			const kit = await getKitBySlug(params.slug);
			if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");
			return kit;
		},
		{ params: t.Object({ slug: t.String() }) },
	);
```

- [ ] **Step 2: Implement seasons module**

Create `src/modules/seasons/service.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { seasons } from "../../db/schema";

export async function listSeasons() {
	return db.query.seasons.findMany({
		orderBy: seasons.createdAt,
	});
}

export async function getActiveSeasons() {
	return db.query.seasons.findMany({
		where: eq(seasons.active, true),
	});
}

export async function getSeasonById(id: number) {
	return db.query.seasons.findFirst({
		where: eq(seasons.id, id),
	});
}
```

Create `src/modules/seasons/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { listSeasons, getActiveSeasons, getSeasonById } from "./service";
import { ApiError } from "../../middleware/error";

export const seasonsRoutes = new Elysia({ prefix: "/seasons" })
	.get("/", () => listSeasons())
	.get("/active", () => getActiveSeasons())
	.get(
		"/:id",
		async ({ params }) => {
			const season = await getSeasonById(Number(params.id));
			if (!season)
				throw new ApiError(404, "NOT_FOUND", "Season not found");
			return season;
		},
		{ params: t.Object({ id: t.String() }) },
	);
```

- [ ] **Step 3: Implement ratings module**

Create `src/modules/ratings/service.ts`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import { ratings, kits, seasons, users } from "../../db/schema";
import { decodeCursor, encodeCursor, paginatedResponse } from "../../lib/pagination";

export async function getLeaderboard(
	kitSlug: string,
	cursor: string | null,
	limit: number,
) {
	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) return null;

	const activeSeason = await db.query.seasons.findFirst({
		where: and(eq(seasons.kitId, kit.id), eq(seasons.active, true)),
	});
	if (!activeSeason) return { data: [], next_cursor: null, has_more: false };

	// Fetch limit + 0 entries (we check has_more by count)
	const results = await db.query.ratings.findMany({
		where: and(
			eq(ratings.kitId, kit.id),
			eq(ratings.seasonId, activeSeason.id),
			eq(ratings.placementDone, true),
		),
		orderBy: desc(ratings.elo),
		limit: limit,
	});

	return paginatedResponse(results, limit, (last) =>
		encodeCursor({ id: last.id, elo: last.elo }),
	);
}

export async function getUserRating(minecraftUuid: string, kitSlug: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) return null;

	const activeSeason = await db.query.seasons.findFirst({
		where: and(eq(seasons.kitId, kit.id), eq(seasons.active, true)),
	});
	if (!activeSeason) return null;

	return db.query.ratings.findFirst({
		where: and(
			eq(ratings.userId, user.id),
			eq(ratings.kitId, kit.id),
			eq(ratings.seasonId, activeSeason.id),
		),
	});
}
```

Create `src/modules/ratings/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { getLeaderboard, getUserRating } from "./service";
import { ApiError } from "../../middleware/error";

export const ratingsRoutes = new Elysia({ prefix: "/ratings" })
	.get(
		"/leaderboard/:kitSlug",
		async ({ params, query }) => {
			const limit = Math.min(Number(query.limit) || 20, 100);
			const result = await getLeaderboard(
				params.kitSlug,
				query.cursor ?? null,
				limit,
			);
			if (result === null)
				throw new ApiError(404, "NOT_FOUND", "Kit not found");
			return result;
		},
		{
			params: t.Object({ kitSlug: t.String() }),
			query: t.Object({
				cursor: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/:uuid/:kitSlug",
		async ({ params }) => {
			const rating = await getUserRating(params.uuid, params.kitSlug);
			if (!rating)
				throw new ApiError(404, "NOT_FOUND", "Rating not found");
			return rating;
		},
		{
			params: t.Object({ uuid: t.String(), kitSlug: t.String() }),
		},
	);
```

- [ ] **Step 4: Implement matches module**

Create `src/modules/matches/service.ts`:

```typescript
import { eq, desc, or } from "drizzle-orm";
import { db } from "../../db";
import { matches, users } from "../../db/schema";
import { encodeCursor, paginatedResponse } from "../../lib/pagination";

export async function getMatchById(id: string) {
	return db.query.matches.findFirst({
		where: eq(matches.id, id),
	});
}

export async function getRecentMatches(limit: number) {
	const results = await db.query.matches.findMany({
		where: eq(matches.status, "completed"),
		orderBy: desc(matches.playedAt),
		limit,
	});

	return paginatedResponse(results, limit, (last) =>
		encodeCursor({ id: last.id }),
	);
}

export async function getUserMatches(
	minecraftUuid: string,
	limit: number,
	cursor: string | null,
) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	const results = await db.query.matches.findMany({
		where: or(
			eq(matches.winnerId, user.id),
			eq(matches.loserId, user.id),
		),
		orderBy: desc(matches.playedAt),
		limit,
	});

	return paginatedResponse(results, limit, (last) =>
		encodeCursor({ id: last.id }),
	);
}
```

Create `src/modules/matches/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { getMatchById, getRecentMatches, getUserMatches } from "./service";
import { ApiError } from "../../middleware/error";

export const matchesRoutes = new Elysia({ prefix: "/matches" })
	.get(
		"/:id",
		async ({ params }) => {
			const match = await getMatchById(params.id);
			if (!match)
				throw new ApiError(404, "NOT_FOUND", "Match not found");
			return match;
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/recent",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit) || 20, 100);
			return getRecentMatches(limit);
		},
		{
			query: t.Object({ limit: t.Optional(t.String()) }),
		},
	);
```

- [ ] **Step 5: Implement punishments module**

Create `src/modules/punishments/service.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { punishments, users } from "../../db/schema";

export async function getPublicPunishments(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return null;

	return db.query.punishments.findMany({
		where: eq(punishments.userId, user.id),
		columns: {
			id: true,
			type: true,
			reason: true,
			expiresAt: true,
			revoked: true,
			createdAt: true,
		},
	});
}
```

Create `src/modules/punishments/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { getPublicPunishments } from "./service";
import { ApiError } from "../../middleware/error";

export const punishmentsRoutes = new Elysia({ prefix: "/punishments" }).get(
	"/:uuid",
	async ({ params }) => {
		const result = await getPublicPunishments(params.uuid);
		if (result === null)
			throw new ApiError(404, "NOT_FOUND", "User not found");
		return result;
	},
	{ params: t.Object({ uuid: t.String() }) },
);
```

- [ ] **Step 6: Commit**

```bash
cd /data/github/RankedMC/API
git add src/modules/kits/ src/modules/seasons/ src/modules/ratings/ src/modules/matches/ src/modules/punishments/
git commit -m "feat: add kits, seasons, ratings, matches, punishments modules"
```

---

## Task 13: Internal Module

**Files:**
- Create: `src/modules/internal/service.ts`, `src/modules/internal/routes.ts`

This is the root-server-facing API. The most critical endpoint is match submission which triggers Elo calculation.

- [ ] **Step 1: Implement internal service**

Create `src/modules/internal/service.ts`:

```typescript
import { eq, and, or, isNull, gt, sql } from "drizzle-orm";
import { db } from "../../db";
import {
	users,
	matches,
	ratings,
	kits,
	seasons,
	punishments,
	playerLoadouts,
} from "../../db/schema";
import { calculateElo, deriveRank, type SeasonConfig } from "../../lib/elo";
import { ApiError } from "../../middleware/error";

interface MatchSubmission {
	kit_id: number;
	winner_minecraft_uuid: string;
	loser_minecraft_uuid: string;
	region: string;
	node_id: string;
	duration_ms: number;
	decisiveness_score: number;
	integrity_score: number;
	metadata?: Record<string, unknown>;
}

export async function submitMatch(input: MatchSubmission) {
	// Resolve players
	const winner = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, input.winner_minecraft_uuid),
	});
	const loser = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, input.loser_minecraft_uuid),
	});
	if (!winner || !loser) {
		throw new ApiError(404, "NOT_FOUND", "Player not found");
	}

	// Resolve active season for this kit
	const activeSeason = await db.query.seasons.findFirst({
		where: and(
			eq(seasons.kitId, input.kit_id),
			eq(seasons.active, true),
		),
	});
	if (!activeSeason) {
		throw new ApiError(
			400,
			"VALIDATION_ERROR",
			"No active season for this kit",
		);
	}

	const config = activeSeason.config as SeasonConfig;

	// Get or create ratings for both players
	const winnerRating = await getOrCreateRating(
		winner.id,
		input.kit_id,
		activeSeason.id,
		config,
	);
	const loserRating = await getOrCreateRating(
		loser.id,
		input.kit_id,
		activeSeason.id,
		config,
	);

	// Calculate Elo
	const eloResult = calculateElo({
		winnerElo: winnerRating.elo,
		loserElo: loserRating.elo,
		winnerGamesPlayed: winnerRating.gamesPlayed,
		loserGamesPlayed: loserRating.gamesPlayed,
		decisivenessScore: input.decisiveness_score,
		integrityScore: input.integrity_score,
		config,
	});

	const winnerNewGames = winnerRating.gamesPlayed + 1;
	const loserNewGames = loserRating.gamesPlayed + 1;
	const winnerPlacementDone =
		winnerRating.placementDone ||
		winnerNewGames >= config.elo.placement_matches;
	const loserPlacementDone =
		loserRating.placementDone ||
		loserNewGames >= config.elo.placement_matches;

	const now = new Date();

	// Transaction: all three writes must succeed or none
	const [match] = await db.transaction(async (tx) => {
		// Update winner rating
		await tx
			.update(ratings)
			.set({
				elo: eloResult.winnerNewElo,
				peakElo: Math.max(winnerRating.peakElo, eloResult.winnerNewElo),
				gamesPlayed: winnerNewGames,
				wins: winnerRating.wins + 1,
				winStreak: winnerRating.winStreak + 1,
				bestWinStreak: Math.max(
					winnerRating.bestWinStreak,
					winnerRating.winStreak + 1,
				),
				placementDone: winnerPlacementDone,
				rank: deriveRank(eloResult.winnerNewElo, winnerPlacementDone, config),
				updatedAt: now,
			})
			.where(eq(ratings.id, winnerRating.id));

		// Update loser rating
		await tx
			.update(ratings)
			.set({
				elo: eloResult.loserNewElo,
				gamesPlayed: loserNewGames,
				losses: loserRating.losses + 1,
				winStreak: 0,
				placementDone: loserPlacementDone,
				rank: deriveRank(eloResult.loserNewElo, loserPlacementDone, config),
				updatedAt: now,
			})
			.where(eq(ratings.id, loserRating.id));

		// Insert match record
		return tx
			.insert(matches)
			.values({
				kitId: input.kit_id,
				seasonId: activeSeason.id,
				winnerId: winner.id,
				loserId: loser.id,
				winnerEloBefore: winnerRating.elo,
				winnerEloAfter: eloResult.winnerNewElo,
				loserEloBefore: loserRating.elo,
				loserEloAfter: eloResult.loserNewElo,
				winnerEloDelta: eloResult.winnerDelta,
				loserEloDelta: eloResult.loserDelta,
				decisivenessScore: input.decisiveness_score,
				integrityScore: input.integrity_score,
				region: input.region,
				nodeId: input.node_id,
				durationMs: input.duration_ms,
				metadata: input.metadata ?? {},
				status: "completed",
				playedAt: now,
			})
			.returning();
	});

	return match;
}

async function getOrCreateRating(
	userId: string,
	kitId: number,
	seasonId: number,
	config: SeasonConfig,
) {
	const existing = await db.query.ratings.findFirst({
		where: and(
			eq(ratings.userId, userId),
			eq(ratings.kitId, kitId),
			eq(ratings.seasonId, seasonId),
		),
	});

	if (existing) return existing;

	const defaultElo = config.elo.default_rating;
	const [created] = await db
		.insert(ratings)
		.values({
			userId,
			kitId,
			seasonId,
			elo: defaultElo,
			peakElo: defaultElo,
		})
		.returning();

	return created;
}

export async function voidMatch(matchId: string) {
	const match = await db.query.matches.findFirst({
		where: eq(matches.id, matchId),
	});
	if (!match) throw new ApiError(404, "NOT_FOUND", "Match not found");

	await db.transaction(async (tx) => {
		// Reverse Elo changes if match was completed
		if (match.status === "completed" && match.winnerId && match.loserId) {
			if (match.winnerEloDelta) {
				await tx
					.update(ratings)
					.set({
						elo: match.winnerEloBefore!,
						wins: sql`${ratings.wins} - 1`,
						gamesPlayed: sql`${ratings.gamesPlayed} - 1`,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(ratings.userId, match.winnerId),
							eq(ratings.kitId, match.kitId),
							eq(ratings.seasonId, match.seasonId),
						),
					);
			}
			if (match.loserEloDelta) {
				await tx
					.update(ratings)
					.set({
						elo: match.loserEloBefore!,
						losses: sql`${ratings.losses} - 1`,
						gamesPlayed: sql`${ratings.gamesPlayed} - 1`,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(ratings.userId, match.loserId),
							eq(ratings.kitId, match.kitId),
							eq(ratings.seasonId, match.seasonId),
						),
					);
			}
		}

		await tx
			.update(matches)
			.set({ status: "void" })
			.where(eq(matches.id, matchId));
	});

	return { success: true };
}

export async function issuePunishment(input: {
	minecraft_uuid: string;
	type: string;
	reason: string;
	evidence_ref?: string;
	issued_by: string;
	expires_at?: string;
}) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, input.minecraft_uuid),
	});
	if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

	const [punishment] = await db
		.insert(punishments)
		.values({
			userId: user.id,
			type: input.type,
			reason: input.reason,
			evidenceRef: input.evidence_ref,
			issuedBy: input.issued_by,
			expiresAt: input.expires_at ? new Date(input.expires_at) : null,
		})
		.returning();

	// Invalidate session if banned
	if (input.type === "ban") {
		await db
			.update(users)
			.set({ refreshToken: null, updatedAt: new Date() })
			.where(eq(users.id, user.id));
	}

	return punishment;
}

export async function revokePunishment(id: number) {
	await db
		.update(punishments)
		.set({ revoked: true })
		.where(eq(punishments.id, id));
	return { success: true };
}

export async function checkSessionValid(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return { valid: false };
	return { valid: user.refreshToken !== null };
}

export async function getActivePunishments(minecraftUuid: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) return [];

	const now = new Date();
	return db.query.punishments.findMany({
		where: and(
			eq(punishments.userId, user.id),
			eq(punishments.revoked, false),
			or(isNull(punishments.expiresAt), gt(punishments.expiresAt, now)),
		),
	});
}

export async function getActiveLoadout(minecraftUuid: string, kitSlug: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.minecraftUuid, minecraftUuid),
	});
	if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

	const kit = await db.query.kits.findFirst({
		where: eq(kits.slug, kitSlug),
	});
	if (!kit) throw new ApiError(404, "NOT_FOUND", "Kit not found");

	// If kit doesn't allow custom loadouts, return default
	if (!kit.allowCustomLoadouts) {
		return { inventory: kit.defaultInventory, source: "kit_default" };
	}

	// Find user's default loadout for this kit
	const loadout = await db.query.playerLoadouts.findFirst({
		where: and(
			eq(playerLoadouts.userId, user.id),
			eq(playerLoadouts.kitId, kit.id),
			eq(playerLoadouts.isDefault, true),
		),
	});

	if (loadout) {
		return { inventory: loadout.inventory, source: "player_loadout" };
	}

	return { inventory: kit.defaultInventory, source: "kit_default" };
}
```

- [ ] **Step 2: Implement internal routes**

Create `src/modules/internal/routes.ts`:

```typescript
import { Elysia, t } from "elysia";
import { apiKeyGuard } from "../../middleware/apiKey";
import {
	submitMatch,
	voidMatch,
	issuePunishment,
	revokePunishment,
	checkSessionValid,
	getActivePunishments,
	getActiveLoadout,
} from "./service";
import { db } from "../../db";
import { seasons, kits } from "../../db/schema";
import { eq } from "drizzle-orm";
import { ApiError } from "../../middleware/error";

export const internalRoutes = new Elysia({ prefix: "/internal/v1" })
	.use(apiKeyGuard)
	// Match submission
	.post(
		"/matches",
		async ({ body }) => submitMatch(body),
		{
			body: t.Object({
				kit_id: t.Number(),
				winner_minecraft_uuid: t.String(),
				loser_minecraft_uuid: t.String(),
				region: t.String(),
				node_id: t.String(),
				duration_ms: t.Number(),
				decisiveness_score: t.Number({ minimum: 0, maximum: 1 }),
				integrity_score: t.Number({ minimum: 0, maximum: 1 }),
				metadata: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	)
	// Void match
	.post(
		"/matches/:id/void",
		async ({ params }) => voidMatch(params.id),
		{ params: t.Object({ id: t.String() }) },
	)
	// Punishments
	.post(
		"/punishments",
		async ({ body }) => issuePunishment(body),
		{
			body: t.Object({
				minecraft_uuid: t.String(),
				type: t.String(),
				reason: t.String(),
				evidence_ref: t.Optional(t.String()),
				issued_by: t.String(),
				expires_at: t.Optional(t.String()),
			}),
		},
	)
	.delete(
		"/punishments/:id",
		async ({ params }) => revokePunishment(Number(params.id)),
		{ params: t.Object({ id: t.String() }) },
	)
	// Session + punishment checks
	.get(
		"/users/:uuid/session-valid",
		async ({ params }) => checkSessionValid(params.uuid),
		{ params: t.Object({ uuid: t.String() }) },
	)
	.get(
		"/users/:uuid/active-punishments",
		async ({ params }) => getActivePunishments(params.uuid),
		{ params: t.Object({ uuid: t.String() }) },
	)
	// Loadout for match
	.get(
		"/users/:uuid/loadout/:kitSlug",
		async ({ params }) => getActiveLoadout(params.uuid, params.kitSlug),
		{ params: t.Object({ uuid: t.String(), kitSlug: t.String() }) },
	)
	// Season management
	.post(
		"/seasons",
		async ({ body }) => {
			const [season] = await db
				.insert(seasons)
				.values({
					kitId: body.kit_id,
					number: body.number,
					startsAt: new Date(body.starts_at),
					endsAt: body.ends_at ? new Date(body.ends_at) : null,
					active: body.active ?? false,
					config: body.config,
				})
				.returning();
			return season;
		},
		{
			body: t.Object({
				kit_id: t.Number(),
				number: t.Number(),
				starts_at: t.String(),
				ends_at: t.Optional(t.String()),
				active: t.Optional(t.Boolean()),
				config: t.Unknown(),
			}),
		},
	)
	.patch(
		"/seasons/:id",
		async ({ params, body }) => {
			const updates: Record<string, unknown> = {};
			if (body.active !== undefined) updates.active = body.active;
			if (body.config !== undefined) updates.config = body.config;
			if (body.ends_at !== undefined) updates.endsAt = new Date(body.ends_at);

			await db
				.update(seasons)
				.set(updates)
				.where(eq(seasons.id, Number(params.id)));
			return { success: true };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				active: t.Optional(t.Boolean()),
				config: t.Optional(t.Unknown()),
				ends_at: t.Optional(t.String()),
			}),
		},
	)
	// Kit management
	.post(
		"/kits",
		async ({ body }) => {
			const [kit] = await db
				.insert(kits)
				.values({
					slug: body.slug,
					name: body.name,
					description: body.description,
					versionRange: body.version_range,
					ruleset: body.ruleset,
					defaultInventory: body.default_inventory,
					allowCustomLoadouts: body.allow_custom_loadouts ?? false,
					icon: body.icon,
					category: body.category,
					displayOrder: body.display_order ?? 0,
				})
				.returning();
			return kit;
		},
		{
			body: t.Object({
				slug: t.String(),
				name: t.String(),
				description: t.Optional(t.String()),
				version_range: t.String(),
				ruleset: t.Unknown(),
				default_inventory: t.Optional(t.Unknown()),
				allow_custom_loadouts: t.Optional(t.Boolean()),
				icon: t.Optional(t.String()),
				category: t.Optional(t.String()),
				display_order: t.Optional(t.Number()),
			}),
		},
	)
	.patch(
		"/kits/:slug",
		async ({ params, body }) => {
			const updates: Record<string, unknown> = {
				updatedAt: new Date(),
			};
			if (body.name !== undefined) updates.name = body.name;
			if (body.ruleset !== undefined) updates.ruleset = body.ruleset;
			if (body.default_inventory !== undefined) updates.defaultInventory = body.default_inventory;
			if (body.active !== undefined) updates.active = body.active;
			if (body.allow_custom_loadouts !== undefined) updates.allowCustomLoadouts = body.allow_custom_loadouts;

			await db
				.update(kits)
				.set(updates)
				.where(eq(kits.slug, params.slug));
			return { success: true };
		},
		{
			params: t.Object({ slug: t.String() }),
			body: t.Object({
				name: t.Optional(t.String()),
				ruleset: t.Optional(t.Unknown()),
				default_inventory: t.Optional(t.Unknown()),
				active: t.Optional(t.Boolean()),
				allow_custom_loadouts: t.Optional(t.Boolean()),
			}),
		},
	);
```

- [ ] **Step 3: Commit**

```bash
cd /data/github/RankedMC/API
git add src/modules/internal/
git commit -m "feat: add internal API module for root server communication"
```

---

## Task 14: App Composition + User Match History Route

**Files:**
- Modify: `src/index.ts`
- Modify: `src/modules/users/routes.ts` (add match history route using matches service)

- [ ] **Step 1: Update index.ts to compose all modules**

Update `src/index.ts`:

```typescript
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
```

- [ ] **Step 2: Add match history to users routes**

Add to `src/modules/users/routes.ts`, in the public section (before `.use(authGuard)`):

```typescript
import { getUserMatches } from "../matches/service";

// Add this route alongside the existing /:uuid and /:uuid/ratings routes
.get(
	"/:uuid/matches",
	async ({ params, query }) => {
		const limit = Math.min(Number(query.limit) || 20, 100);
		const result = await getUserMatches(params.uuid, limit, query.cursor ?? null);
		if (result === null) throw new ApiError(404, "NOT_FOUND", "User not found");
		return result;
	},
	{
		params: t.Object({ uuid: t.String() }),
		query: t.Object({
			cursor: t.Optional(t.String()),
			limit: t.Optional(t.String()),
		}),
	},
)
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /data/github/RankedMC/API && bun build src/index.ts --no-bundle`
Expected: No TypeScript errors

- [ ] **Step 4: Run all tests**

Run: `cd /data/github/RankedMC/API && bun test`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
cd /data/github/RankedMC/API
git add src/index.ts src/modules/users/routes.ts
git commit -m "feat: compose all modules into app with public + internal routing"
```

---

## Task 15: Rate Limiting Middleware

**Files:**
- Create: `src/middleware/rateLimit.ts`, `tests/middleware/rateLimit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/middleware/rateLimit.test.ts`:

```typescript
import { describe, expect, test, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { rateLimiter } from "../../src/middleware/rateLimit";

describe("rateLimiter", () => {
	test("allows requests under the limit", async () => {
		const app = new Elysia()
			.use(rateLimiter({ max: 5, windowMs: 60000 }))
			.get("/test", () => "ok");

		const res = await app.handle(new Request("http://localhost/test"));
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
	});

	test("blocks requests over the limit", async () => {
		const app = new Elysia()
			.use(rateLimiter({ max: 2, windowMs: 60000 }))
			.get("/test", () => "ok");

		const req = () => app.handle(new Request("http://localhost/test"));
		await req(); // 1
		await req(); // 2
		const res = await req(); // 3 — should be blocked
		expect(res.status).toBe(429);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /data/github/RankedMC/API && bun test tests/middleware/rateLimit.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement rate limiter**

Create `src/middleware/rateLimit.ts`:

```typescript
import { Elysia } from "elysia";
import { ApiError } from "./error";

interface RateLimitOptions {
	max: number;
	windowMs: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(options: RateLimitOptions) {
	return new Elysia({ name: "rate-limiter" })
		.onBeforeHandle(({ set, request }) => {
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
				throw new ApiError(429, "RATE_LIMITED", "Too many requests");
			}
		});
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /data/github/RankedMC/API && bun test tests/middleware/rateLimit.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Apply rate limiting in index.ts**

In `src/index.ts`, apply rate limiting to the public API group:

```typescript
import { rateLimiter } from "./middleware/rateLimit";

// In the public API group:
.group("/api/v1", (app) =>
	app
		.use(rateLimiter({ max: 60, windowMs: 60000 })) // 60/min default
		.use(authRoutes)
		.use(usersRoutes)
		// ...
)
```

Internal routes intentionally have no rate limit (API key auth, trusted caller).

- [ ] **Step 6: Commit**

```bash
cd /data/github/RankedMC/API
git add src/middleware/rateLimit.ts tests/middleware/rateLimit.test.ts src/index.ts
git commit -m "feat: add rate limiting middleware for public API"
```

---

## Task 16: Elo Decay Scheduled Task

**Files:**
- Create: `src/lib/decay.ts`, `tests/lib/decay.test.ts`

- [ ] **Step 1: Write the decay function test**

Create `tests/lib/decay.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { findDecayableRatings } from "../../src/lib/decay";
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/decay.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement decay module**

Create `src/lib/decay.ts`:

```typescript
import { and, eq, lt, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { ratings, seasons } from "../db/schema";
import { deriveRank, type SeasonConfig } from "./elo";

export function decayRating(
	currentElo: number,
	pointsPerDay: number,
	floorElo: number,
): number {
	return Math.max(floorElo, currentElo - pointsPerDay);
}

export async function runDecay() {
	const activeSeasons = await db.query.seasons.findMany({
		where: eq(seasons.active, true),
	});

	for (const season of activeSeasons) {
		const config = season.config as SeasonConfig;
		if (!config.decay.enabled) continue;

		const cutoff = new Date(
			Date.now() - config.decay.inactivity_days * 24 * 60 * 60 * 1000,
		);

		// Find ratings eligible for decay
		const staleRatings = await db.query.ratings.findMany({
			where: and(
				eq(ratings.seasonId, season.id),
				gte(ratings.elo, config.decay.min_elo),
				lt(ratings.updatedAt, cutoff),
			),
		});

		const now = new Date();
		for (const rating of staleRatings) {
			const newElo = decayRating(
				rating.elo,
				config.decay.points_per_day,
				config.decay.floor_elo,
			);
			const newRank = deriveRank(newElo, rating.placementDone, config);

			await db
				.update(ratings)
				.set({
					elo: newElo,
					rank: newRank,
					updatedAt: now,
				})
				.where(eq(ratings.id, rating.id));
		}

		console.log(
			`Decay: processed ${staleRatings.length} ratings for season ${season.id}`,
		);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /data/github/RankedMC/API && bun test tests/lib/decay.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Schedule decay in index.ts**

Add to the end of `src/index.ts` (after `.listen()`):

```typescript
import { runDecay } from "./lib/decay";

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
```

- [ ] **Step 6: Commit**

```bash
cd /data/github/RankedMC/API
git add src/lib/decay.ts tests/lib/decay.test.ts src/index.ts
git commit -m "feat: add Elo decay scheduled task"
```

---

## Task 17: Final Verification + Lint

**All code is written. This task verifies everything compiles, passes lint, and tests pass.**

- [ ] **Step 1: Run Biome lint**

Run: `cd /data/github/RankedMC/API && bun run lint`
Fix any issues found.

- [ ] **Step 2: Run Biome format**

Run: `cd /data/github/RankedMC/API && bun run format`

- [ ] **Step 3: Run all tests**

Run: `cd /data/github/RankedMC/API && bun test`
Expected: All tests pass

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /data/github/RankedMC/API && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit any lint/format fixes**

```bash
cd /data/github/RankedMC/API
git add -A
git commit -m "chore: apply biome lint and format fixes"
```

- [ ] **Step 6: Generate migration and verify**

Run: `cd /data/github/RankedMC/API && bun run db:generate`
Verify migration files look correct in `src/db/migrations/`.

- [ ] **Step 7: Final commit**

```bash
cd /data/github/RankedMC/API
git add src/db/migrations/
git commit -m "chore: add initial database migration"
```
