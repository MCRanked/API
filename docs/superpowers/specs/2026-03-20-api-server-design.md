# API Server Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Scope:** MVP scaffold for the RankedMC API server — application plane for the competitive Minecraft PvP platform.
**MVP Scope:** 1v1 matches only. Multi-player formats (2v2, FFA) will require a `match_participants` junction table in a future migration.

## Overview

The API server is the application plane for RankedMC. It exclusively owns the PostgreSQL database (single source of truth for all persistent data), powers the website, serves public/community APIs with OpenAPI docs, and exposes internal API-key-locked endpoints for the root server (control plane) to push match results and manage platform state.

**Runtime:** Bun + Elysia + TypeScript
**ORM:** Drizzle ORM
**Database:** PostgreSQL
**Linting/Formatting:** Biome (defaults — tabs, opinionated)
**Auth:** Minecraft OAuth (Microsoft/Xbox Live) — dual flow (web + launcher)

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DB ownership | API exclusively owns PostgreSQL | Clean trust boundary — root uses Redis for ephemeral state, pushes results via HTTPS |
| Root → API | HTTPS with API key | Simpler than gRPC, Elysia handles it natively, no proto dependency between API and root |
| Endpoint split | `/api/v1/` public, `/internal/v1/` root-only | Path-prefix split for clear separation, OpenAPI naturally excludes internal, easy to firewall |
| Sessions | JWT access (15 min) + opaque refresh (30 days, rotating) | Fast stateless validation + instant revocation via refresh token deletion |
| Module structure | Hybrid — shared infra + feature modules | `src/db/`, `src/middleware/`, `src/lib/` shared; `src/modules/` per-feature Elysia plugins |
| Module composition | Plugin-per-module with direct imports | Services import DB client directly, no DI ceremony, simpler for MVP |
| Kit config | JSONB ruleset on kits table | Flexible, no migrations for new kit parameters, queryable with PostgreSQL JSON operators |
| Rating config | JSONB config on seasons table | Per-kit per-season tuning without code changes, historical configs preserved |

## Project Structure

```
API/
├── src/
│   ├── index.ts                    # App entry, composes all module plugins
│   ├── config.ts                   # Typed env var config
│   ├── db/
│   │   ├── index.ts                # Drizzle client + connection
│   │   ├── schema/
│   │   │   ├── users.ts
│   │   │   ├── kits.ts
│   │   │   ├── ratings.ts
│   │   │   ├── matches.ts
│   │   │   ├── seasons.ts
│   │   │   ├── punishments.ts
│   │   │   └── player-loadouts.ts
│   │   └── migrations/
│   ├── middleware/
│   │   ├── auth.ts                 # JWT verification, session guards
│   │   ├── apiKey.ts               # Internal endpoint API key check
│   │   └── error.ts                # Global error handler
│   ├── lib/
│   │   ├── microsoft-auth.ts       # Microsoft → Xbox → XSTS → Minecraft token exchange
│   │   ├── minecraft-auth.ts       # Minecraft token verification (launcher flow)
│   │   ├── jwt.ts                  # JWT sign/verify/refresh helpers
│   │   └── elo.ts                  # Rating calculation engine (config-driven)
│   └── modules/
│       ├── auth/
│       │   ├── routes.ts
│       │   └── service.ts
│       ├── users/
│       │   ├── routes.ts
│       │   └── service.ts
│       ├── matches/
│       │   ├── routes.ts
│       │   └── service.ts
│       ├── ratings/
│       │   ├── routes.ts
│       │   └── service.ts
│       ├── kits/
│       │   ├── routes.ts
│       │   └── service.ts
│       ├── seasons/
│       │   ├── routes.ts
│       │   └── service.ts
│       ├── punishments/
│       │   ├── routes.ts
│       │   └── service.ts
│       └── internal/
│           ├── routes.ts
│           └── service.ts
├── drizzle.config.ts
├── biome.json
├── package.json
├── tsconfig.json
└── .env.example
```

## Conventions

### Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

Notable error codes:

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid input, details has field-level errors |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT or refresh token |
| 403 | `FORBIDDEN` | Valid auth but insufficient permission (e.g., banned user) |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate (e.g., loadout name already exists) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Pagination

All paginated endpoints use cursor-based pagination:

- Query params: `?cursor=<opaque_string>&limit=<int>` (default limit 20, max 100)
- Response wrapper:
```json
{
  "data": [],
  "next_cursor": "abc123",
  "has_more": true
}
```

Cursors are opaque base64-encoded values. Clients should not parse them.

### Rate Limiting

- Unauthenticated endpoints: 60 requests/minute per IP
- Authenticated endpoints: 120 requests/minute per user
- Internal endpoints: no rate limit (API key auth, trusted caller)

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Session Policy

Single active session per user. Logging in from a new device invalidates the previous refresh token. This is intentional — it simplifies revocation and prevents session sprawl. If multi-device support is needed later, a `sessions` table can replace the single `refresh_token` column on users.

### Refresh Token Hashing

Refresh tokens are 64-byte random hex (512 bits of entropy). SHA-256 is appropriate for hashing high-entropy secrets — bcrypt/argon2 are designed for low-entropy passwords and would add unnecessary latency. The high entropy of the token itself is what provides security.

## Database Schema

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, generated |
| minecraft_uuid | VARCHAR(36) | UNIQUE, NOT NULL |
| username | VARCHAR(16) | NOT NULL |
| microsoft_id | VARCHAR(255) | nullable |
| refresh_token | VARCHAR(255) | nullable, stored hashed (SHA-256) |
| version_preference | VARCHAR(32) | DEFAULT '1.8' |
| language | VARCHAR(8) | DEFAULT 'en' |
| preferences | JSONB | DEFAULT '{}' |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |
| last_seen_at | TIMESTAMP | nullable |

### kits

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| slug | VARCHAR(32) | UNIQUE, NOT NULL |
| name | VARCHAR(64) | NOT NULL |
| description | TEXT | nullable |
| version_range | VARCHAR(32) | NOT NULL |
| ruleset | JSONB | NOT NULL — full combat rules + inventory_rules |
| default_inventory | JSONB | nullable — default loadout |
| allow_custom_loadouts | BOOLEAN | DEFAULT false |
| icon | VARCHAR(255) | nullable |
| category | VARCHAR(32) | nullable — 'classic', 'modern', 'experimental' |
| display_order | INTEGER | DEFAULT 0 |
| active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

#### kits.ruleset structure

```json
{
  "combat": {
    "kb_formula": "...",
    "cps_cap": null,
    "hit_registration": "...",
    "pearl_cooldown_ms": 16000,
    "hunger_enabled": true,
    "sprint_settings": "...",
    "armor_damage_profile": "...",
    "potion_rules": "..."
  },
  "inventory_rules": {
    "slots": {
      "0-8": { "allowed_items": [...], "required": { "0": "diamond_sword" } },
      "9-35": { "allowed_items": [...], "max_per_item": { "golden_apple": 16 } },
      "36-39": { "armor": { "36": "diamond_boots", ... }, "locked": true },
      "40": { "allowed_items": ["shield"], "locked": false }
    },
    "containers": {
      "shulker_box": {
        "allowed": true,
        "max_count": 2,
        "allowed_contents": ["potion", "splash_potion"],
        "max_stack": 1
      }
    },
    "total_limits": { "splash_potion": 32, "golden_apple": 8 },
    "allow_custom_arrangement": true,
    "locked_slots": [0, 36, 37, 38, 39]
  }
}
```

### seasons

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| kit_id | FK → kits.id | NOT NULL |
| number | INTEGER | NOT NULL |
| starts_at | TIMESTAMP | NOT NULL |
| ends_at | TIMESTAMP | nullable |
| active | BOOLEAN | DEFAULT false |
| config | JSONB | NOT NULL — Elo params, rank tiers, decay rules |
| created_at | TIMESTAMP | DEFAULT now() |
| UNIQUE(kit_id, number) | | |

#### seasons.config structure

```json
{
  "elo": {
    "default_rating": 1000,
    "base_divisor": 400,
    "k_factors": {
      "placement": { "max_games": 10, "k": 40 },
      "established": { "max_games": 100, "k": 25 },
      "veteran": { "k": 16 }
    },
    "decisiveness": {
      "min_multiplier": 0.80,
      "mid_multiplier": 1.00,
      "max_multiplier": 1.25
    },
    "integrity": {
      "perfect": 1.00,
      "minor_threshold": 0.70,
      "minor_multiplier": 0.85,
      "degraded_threshold": 0.50,
      "degraded_multiplier": 0.70,
      "floor_multiplier": 0.50
    },
    "placement_matches": 10
  },
  "ranks": [
    { "name": "Unranked", "min_elo": null, "placement_required": false },
    { "name": "Bronze", "min_elo": 0 },
    { "name": "Silver", "min_elo": 1000 },
    { "name": "Gold", "min_elo": 1200 },
    { "name": "Platinum", "min_elo": 1400 },
    { "name": "Diamond", "min_elo": 1600 },
    { "name": "Master", "min_elo": 1800 },
    { "name": "Champion", "min_elo": 2000 }
  ],
  "decay": {
    "enabled": true,
    "min_elo": 1800,
    "inactivity_days": 14,
    "points_per_day": 5,
    "floor_elo": 1600
  }
}
```

### ratings

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | FK → users.id | NOT NULL |
| kit_id | FK → kits.id | NOT NULL |
| season_id | FK → seasons.id | NOT NULL |
| elo | INTEGER | NOT NULL (set from season config.elo.default_rating) |
| peak_elo | INTEGER | NOT NULL (initialized to same as elo) |
| rank | VARCHAR(32) | nullable |
| games_played | INTEGER | DEFAULT 0 |
| wins | INTEGER | DEFAULT 0 |
| losses | INTEGER | DEFAULT 0 |
| win_streak | INTEGER | DEFAULT 0 |
| best_win_streak | INTEGER | DEFAULT 0 |
| placement_done | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |
| UNIQUE(user_id, kit_id, season_id) | | |

### matches

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, generated |
| kit_id | FK → kits.id | NOT NULL |
| season_id | FK → seasons.id | NOT NULL |
| winner_id | FK → users.id | nullable (draws/cancels) |
| loser_id | FK → users.id | nullable |
| winner_elo_before | INTEGER | nullable |
| winner_elo_after | INTEGER | nullable |
| loser_elo_before | INTEGER | nullable |
| loser_elo_after | INTEGER | nullable |
| winner_elo_delta | INTEGER | nullable |
| loser_elo_delta | INTEGER | nullable |
| decisiveness_score | REAL | NOT NULL, CHECK 0.0–1.0 |
| integrity_score | REAL | NOT NULL, CHECK 0.0–1.0 |
| region | VARCHAR(16) | NOT NULL |
| node_id | VARCHAR(64) | NOT NULL |
| duration_ms | INTEGER | NOT NULL |
| metadata | JSONB | kit-specific stats |
| status | VARCHAR(16) | NOT NULL — 'completed', 'cancelled', 'void' |
| played_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT now() |

### punishments

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | FK → users.id | NOT NULL |
| type | VARCHAR(16) | NOT NULL — 'ban', 'mute', 'warning', 'restriction' |
| reason | TEXT | NOT NULL |
| evidence_ref | VARCHAR(255) | nullable |
| issued_by | VARCHAR(64) | NOT NULL — 'system', 'anticheat', or moderator ID |
| expires_at | TIMESTAMP | nullable (null = permanent) |
| revoked | BOOLEAN | DEFAULT false |
| revoked_reason | TEXT | nullable |
| created_at | TIMESTAMP | DEFAULT now() |

### player_loadouts

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | FK → users.id | NOT NULL |
| kit_id | FK → kits.id | NOT NULL |
| name | VARCHAR(32) | DEFAULT 'default' |
| inventory | JSONB | NOT NULL |
| is_default | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |
| UNIQUE(user_id, kit_id, name) | | |

Loadouts are validated against `kits.ruleset.inventory_rules` on save (API) and on match start (node).

### Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| ratings | `(kit_id, season_id, elo DESC)` | Leaderboard queries |
| ratings | `(user_id, kit_id, season_id)` | Unique constraint + user rating lookups |
| matches | `(winner_id, played_at DESC)` | User match history |
| matches | `(loser_id, played_at DESC)` | User match history |
| matches | `(kit_id, season_id, played_at DESC)` | Recent matches by kit |
| punishments | `(user_id, revoked)` | Active punishment checks |
| player_loadouts | `(user_id, kit_id)` | Loadout fetches |

## Auth Flows

### Flow A: Web OAuth (website)

1. Browser → `GET /api/v1/auth/login`
2. API redirects to Microsoft OAuth authorize URL
3. User authenticates with Microsoft
4. Microsoft redirects → `GET /api/v1/auth/callback?code=xxx`
5. API exchanges: code → Microsoft token → Xbox Live token → XSTS token → Minecraft access token
6. API calls Minecraft Services profile endpoint → UUID + username
7. Upsert user record
8. Generate JWT access token (15 min) + opaque refresh token (hashed, stored in DB)
9. Return tokens (access in body, refresh as httpOnly cookie)

### Flow B: Launcher Verify (game client)

1. Launcher handles Microsoft auth natively (already has Minecraft token)
2. Launcher → `POST /api/v1/auth/verify` with Minecraft access token
3. API verifies token against Minecraft Services → UUID + username
4. Upsert user record
5. Generate JWT + refresh token
6. Return tokens

### Session Model

**JWT Access Token (15 min):**
```json
{
  "sub": "user.id (UUID)",
  "minecraft_uuid": "...",
  "username": "...",
  "iat": 0,
  "exp": 0
}
```

**Refresh Token:** Random 64-byte hex, stored hashed (SHA-256), 30-day expiry, single-use with rotation.

**Refresh:** `POST /api/v1/auth/refresh` — validates hashed token, issues new JWT + new refresh token.

**Revocation:** Delete refresh_token from DB. JWT continues until 15 min expiry. Optional in-memory deny-list for immediate revocation.

## API Endpoints

### Public — `/api/v1/` (OpenAPI documented)

**Auth:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/login` | None | Redirect to Microsoft OAuth |
| GET | `/auth/callback` | None | OAuth callback, returns tokens |
| POST | `/auth/verify` | None | Launcher verify, returns tokens |
| POST | `/auth/refresh` | Refresh | Rotate tokens |
| POST | `/auth/logout` | JWT | Invalidate refresh token |

**Users:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | JWT | Current user profile |
| GET | `/users/:uuid` | None | Public profile |
| GET | `/users/:uuid/ratings` | None | All kit ratings |
| GET | `/users/:uuid/matches` | None | Match history (paginated) |
| PATCH | `/users/me/preferences` | JWT | Update language, settings |

**Loadouts:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me/loadouts` | JWT | All loadouts |
| GET | `/users/me/loadouts/:kitSlug` | JWT | Loadouts for a kit |
| PUT | `/users/me/loadouts/:kitSlug/:name` | JWT | Create/update loadout by name |
| DELETE | `/users/me/loadouts/:kitSlug/:name` | JWT | Delete loadout |

**Kits:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/kits` | None | List active kits |
| GET | `/kits/:slug` | None | Kit details + ruleset |

**Ratings / Leaderboards:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ratings/leaderboard/:kitSlug` | None | Top players (paginated) |
| GET | `/ratings/:uuid/:kitSlug` | None | User's rating for a kit |

**Matches:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/matches/:id` | None | Match details + elo breakdown |
| GET | `/matches/recent` | None | Recent matches |

**Seasons:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/seasons` | None | List all seasons |
| GET | `/seasons/active` | None | Active seasons per kit |
| GET | `/seasons/:id` | None | Season details |

**Punishments:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/punishments/:uuid` | None | Public punishment history |

### Internal — `/internal/v1/` (API key required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/matches` | Submit match result → triggers Elo calculation |
| POST | `/matches/:id/void` | Void a match |
| POST | `/punishments` | Issue punishment |
| DELETE | `/punishments/:id` | Revoke punishment |
| GET | `/users/:uuid/session-valid` | Check session validity |
| GET | `/users/:uuid/active-punishments` | Check bans/restrictions |
| GET | `/users/:uuid/loadout/:kitSlug` | Get active loadout for match |
| POST | `/seasons` | Create season with config |
| PATCH | `/seasons/:id` | Update season config |
| POST | `/kits` | Create kit |
| PATCH | `/kits/:slug` | Update kit |

## Elo Calculation Engine

Config-driven, kit-agnostic. All parameters read from `seasons.config`.

### Formula

```
Expected = 1 / (1 + 10^((opponent_elo - player_elo) / config.elo.base_divisor))
BaseDelta = K × (Actual - Expected)
FinalDelta = BaseDelta × DecisivenessMultiplier × IntegrityMultiplier
```

- **K-factor:** From `config.elo.k_factors` based on games played
- **Decisiveness multiplier:** Piecewise linear — score 0.0 maps to `min_multiplier` (0.80), score 0.5 maps to `mid_multiplier` (1.00), score 1.0 maps to `max_multiplier` (1.25). Linearly interpolate between adjacent points.
- **Integrity multiplier:** Stepped from `config.elo.integrity` thresholds
- **Rank derivation:** Iterate `config.ranks` in descending order; the first entry where `player_elo >= min_elo` determines the rank. If placement is incomplete, rank is "Unranked".

### Input (from root server)

```json
{
  "kit_id": 1,
  "winner_minecraft_uuid": "...",
  "loser_minecraft_uuid": "...",
  "region": "us-east",
  "node_id": "...",
  "duration_ms": 45000,
  "decisiveness_score": 0.35,
  "integrity_score": 0.95,
  "metadata": {}
}
```

### Output (to players via match detail)

```json
{
  "elo_before": 1600,
  "elo_after": 1608,
  "elo_delta": 8,
  "breakdown": {
    "base_elo_change": 9,
    "opponent_strength": "+50 above you",
    "close_match_adjustment": -2,
    "match_integrity": "excellent",
    "integrity_adjustment": 0
  }
}
```

Node computes `decisiveness_score` and `integrity_score` from raw combat telemetry. API applies them as multipliers. This keeps the Elo engine kit-agnostic — new kits only require node-side changes.

UUIDs in match submissions refer to Minecraft UUIDs (`minecraft_uuid`). The API resolves these to internal user IDs via lookup.

### Season Resolution

When a match is submitted, the API resolves the active season for the given `kit_id`. There must be exactly one active season per kit at any time. If no active season exists for the kit, the match submission is rejected with a `VALIDATION_ERROR`. The resolved `season_id` is used for the rating lookup/update and stored on the match record.

### Decay Execution

Elo decay runs as a daily cron job (or scheduled Bun task). For each active season where `config.decay.enabled` is true:

1. Query ratings where `updated_at < now() - config.decay.inactivity_days` AND `elo >= config.decay.min_elo`
2. Decrement `elo` by `config.decay.points_per_day`, flooring at `config.decay.floor_elo`
3. Update `rank` if the new Elo crosses a threshold
4. Set `updated_at` to now (so decay applies once per day, not compounding)

## Inventory Validation

Two-phase validation:

1. **API on save:** Player saves loadout → API validates against `kits.ruleset.inventory_rules` → accepts or rejects with specific error
2. **Node on match start:** Node fetches loadout + kit ruleset → re-validates → spawns or falls back to default inventory

Kit is the sole authority on legal inventory contents. Loadout is the player's arrangement within those rules.

## Key Design Principles

- **API owns all persistent data** — root and nodes never write to PostgreSQL directly
- **Transparency** — all rating math is public, post-match breakdown shown to players
- **Config over code** — season configs, kit rulesets, and rank tiers are data, not hardcoded
- **Defense in depth** — loadout validation at API (UX) and node (integrity)
- **Trust boundaries** — internal endpoints API-key-locked, JWT for users, refresh rotation for security
