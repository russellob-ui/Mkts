# FINAL PLAN — WC Sweep 2026 Fantasy Football
## ARBITER synthesis, 21 May 2026

Output of the LLM Council protocol (3 planners: CONTRARIAN / FIRST PRINCIPLES / EXECUTOR; 3 reviewers: RAVEN / ANVIL / PHANTOM; 1 arbiter). This is the canonical build spec.

---

## 1. Synthesis logic

**Backbone: FIRST PRINCIPLES plan.** It is the only plan that asked "what is this product for?" before "what tables do we need?" RAVEN's pattern observation is correct: the other two clone FPL; this one derives a fantasy game for 8 mates on WhatsApp where the sweep is canonical. PHANTOM's negative-space audit also lands hardest on it as already the closest to it. The axioms (data is provisional, sweep is canon, screenshot-first, finite asymmetric tournament) are load-bearing for every downstream decision.

**Grafted from CONTRARIAN**: the `scoring_tier` column on the footballer-points table. RAVEN named this "the single best engineering decision across all plans" and ARBITER agrees — it converts a deploy-time fallback into a per-row attribution with audit trail. Also grafting the dated trigger cascade (T-14/T-10/T-7/T-2/GW1) and the "N of your 15 players play this GW" telemetry for chip warnings.

**Grafted from EXECUTOR**: the kill list discipline, 4-layer idempotency (event_log PK + player_gw_stats UNIQUE + match.fantasy_finalised + squad_gw_scores UNIQUE), 36-hour stabilisation buffer, day-by-day cadence.

**Rejecting**: EXECUTOR's "reuses sweep's events payload, no new fetches" — ANVIL correctly flagged this as unaudited. Rejecting CONTRARIAN's mid-tournament scoring-tier switching as a deploy operation — ANVIL is right that the totals are non-commensurable; the tier is locked at GW1 and the column is for audit, not switching. Rejecting FIRST PRINCIPLES' Match MVP +3 as a unilateral product divergence — PHANTOM is right that it can't be smuggled in as a fallback decision; it requires sign-off in the 30-min call.

**Adding what no plan included** (per PHANTOM): default squad templates, auto-manage toggle, server-authoritative countdown, "data provisional" 24h badge, blank-squad protector, sibling-route hard isolation. All six are mandated.

---

## 2. Sweep isolation guarantee

Every reviewer flagged this; no plan included it. Specification, non-negotiable:

1. **Sibling route**: all fantasy pages live under `/fantasy/*`. No fantasy components imported by any `/sweep/*` page. ESLint rule `no-restricted-imports` enforces it.
2. **Top-level feature flag**: `process.env.FANTASY_ENABLED` (default `false` until GW1 lock). Middleware redirects `/fantasy/*` to `/` when disabled. Single env-var flip kills the entire feature in <60s without redeploy via Vercel env override.
3. **Try/catch boundary in poll-matches**: every fantasy hook in `src/lib/poll-matches.ts` wrapped in `try { await processFantasyEvents(match) } catch (e) { logFantasyError(e, { matchId, gw }); /* swallow */ }`. Fantasy failure must NEVER abort sweep processing. Logged to `fantasy_error_log` table, surfaced on admin dashboard.
4. **Rollback script**: `scripts/fantasy-rollback.ts` — drops all `fantasy_*` tables, drops `footballers`, drops `footballer_events`. (We are NOT renaming `players` — see §4.) Tested on staging Day 1.
5. **Kill switch UI**: admin page `/admin/fantasy-kill` — sets `FANTASY_ENABLED=false` via Vercel API + posts to WhatsApp webhook + freezes all fantasy crons.
6. **Database isolation**: zero foreign keys from `fantasy_*` tables to existing sweep tables EXCEPT `players.id` (read-only). No CASCADE deletes touch sweep.
7. **Cron isolation**: fantasy uses separate Vercel cron path `/api/cron/fantasy-poll`, never invokes sweep poller, fails independently.

---

## 3. Pre-build Day 0 audit (4 hours, before any code)

ANVIL identified this as decision-reordering. Mandatory.

**Task**: instrument the existing sweep poller for 4 hours of live observation against API-Football, write findings to `/docs/fantasy/day0-audit.md` committed to repo.

**Fetch and log against an upcoming friendly** (any internationals friendly this week — there are 4 fixtures 27-30 May per FIFA window):

**Primary: API-Football**
1. `GET /fixtures?league=X&season=2026` — record latency, response size, rate-limit headers.
2. `GET /fixtures/events?fixture=Y` — record whether `player.id` and `assist.id` are populated, percentage of nulls, event types present.
3. `GET /fixtures/lineups?fixture=Y` — record whether `startXI` is populated 1h pre-KO vs at-KO vs post-KO, do substitutes appear, do positions match our 4 categories.
4. `GET /fixtures/players?fixture=Y` — THE critical call. Record: populated at FT? At 90'+? Stats schema (minutes, goals, assists, cards, saves, rating). Is it the actual fixture data or empty arrays.
5. `GET /players?league=X&season=2026` — does the WC 2026 player pool exist yet? How many?
6. **Audit the existing sweep poller code**: which of the above does `poll-matches.ts` already fetch? Document line-by-line.
7. **Rate limit observation**: trigger 30 calls in 60s, observe 429 behaviour, document backoff requirements.

**Backup API evaluation (NEW, mandated by user decision 21 May — no manual admin scoring allowed)**. Spike each for ~30 min:
8. **SportMonks Football API** (`football.sportmonks.com`) — request demo / free tier, confirm WC 2026 season coverage, per-player live stats schema, pricing.
9. **Sofascore** — investigate `api.sofascore.com` reverse-engineered endpoints (legality/ToS risk to document). Some endpoints public via mobile-app traffic.
10. **FotMob** (`www.fotmob.com/api`) — similar semi-public endpoints.
11. **StatsBomb Open Data** — confirm whether WC 2026 will be in their open data programme (historical-only is likely, but check).
12. **Optasports / Stats Perform** — note pricing/contact, almost certainly out of budget but document for completeness.

**Deliverable**: `/docs/fantasy/day0-audit.md` with: (a) API-Football WC 2026 tier feasibility today, (b) at least 2 evaluated backup providers ranked by cost × coverage × integration effort, (c) which calls already happen in sweep poller, (d) burst-cost estimate for 4 simultaneous group-stage matches, (e) GO/NO-GO on Tier 1A; if NO-GO, the recommended Tier 1B backup with integration cost estimate.

---

## 4. Final decisions (locked by Arbiter + User, 21 May 2026)

| Decision | Value | Rationale |
|---|---|---|
| Rename `players` table | **NO** | High blast radius for a live app with FKs and seed data; PHANTOM. Use type alias `type Human = Player`. |
| Footballer table name | `footballers` | Unprefixed — domain entity, owns its noun. |
| Table prefix | `fantasy_*` | For fantasy-feature tables. `footballers`/`footballer_events` unprefixed. |
| Combined leaderboard | **NO** | Sweep is canon (FIRST PRINCIPLES axiom A5); RAVEN agreed. |
| Bonus points | **DROPPED entirely** (user, 21 May) | No BPS, no Match MVP. Pure FPL scoring on goals/assists/CS/cards/saves only. |
| In-tournament price changes | **NO** | Heuristic noise compounds; static prices locked at GW1. |
| Wildcard count | **1** | Knockouts already grant free forced transfers; 2 wildcards → infinite transfers. |
| Chip stacking same GW | **NO** | One chip per GW. |
| Pre-deadline squad visibility | **N-of-8 only** | Drives WhatsApp nags; no leak vectors in server responses. |
| Post-deadline squad visibility | **Public at deadline lock** (user, 21 May) | Drives banter; 8 mates not strangers. |
| Auto-pick on no-submit | **YES** | T-60min Balanced template + WhatsApp ping (PHANTOM blank-squad protector). |
| Default squad templates | **YES (3)** | Balanced / Attacking / Safe — onboarding for FPL-naive (PHANTOM). |
| Presentation | **Sibling sites, shared nav** | Top nav Sweep \| Fantasy tabs; distinct route trees; §2 isolation. |
| Knockout free transfers | **Unlimited for eliminated nations** (user, 21 May) | Every player from an eliminated nation swappable for free, no cap, no -4. |
| Prize pot | **Separate £40 fantasy pot, winner-takes-all** (user, 21 May) | Sweep prize untouched; two distinct competitions, two winners. |
| **Tier 3 ADMIN scoring** | **REJECTED** (user, 21 May) | **No manual admin entry. Must be API-driven. If API-Football fails to deliver per-player data, switch to a backup commercial API (SportMonks, Sofascore, FotMob, StatsBomb). Day 0 audit must evaluate backups.** |

---

## 5. Final schema (Drizzle / SQL)

```sql
-- NOT renaming existing `players` table. Existing schema untouched.

-- ===== DOMAIN ENTITIES (unprefixed) =====

CREATE TABLE footballers (
  id              SERIAL PRIMARY KEY,
  api_player_id   INTEGER UNIQUE,                       -- nullable for manual entries
  full_name       TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  nation          TEXT NOT NULL,                        -- ISO 3-letter
  position        TEXT NOT NULL CHECK (position IN ('GK','DEF','MID','FWD')),
  price_tenths    INTEGER NOT NULL,                     -- £4.5m stored as 45
  data_source     TEXT NOT NULL CHECK (data_source IN ('api-football','manual','heuristic')),
  eliminated_at   TIMESTAMPTZ,                          -- when nation knocked out
  is_active       BOOLEAN NOT NULL DEFAULT true,        -- soft delete
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_footballers_nation ON footballers(nation);
CREATE INDEX idx_footballers_position ON footballers(position);
CREATE INDEX idx_footballers_price ON footballers(price_tenths);

CREATE TABLE footballer_events (
  id              SERIAL PRIMARY KEY,
  match_id        INTEGER NOT NULL REFERENCES matches(id),
  footballer_id   INTEGER NOT NULL REFERENCES footballers(id),
  event_type      TEXT NOT NULL,                        -- goal, assist, yellow, red, og, pensaved, penmissed, cs, conceded, save, minutes
  minute          INTEGER,                              -- nullable for aggregate events (minutes, cs)
  value           INTEGER NOT NULL DEFAULT 1,           -- count, or for minutes the actual mins
  source          TEXT NOT NULL,                        -- 'api-football-events', 'api-football-players', 'admin', 'derived'
  scoring_tier    TEXT NOT NULL CHECK (scoring_tier IN ('LIVE','SIMPLIFIED','ADMIN')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, footballer_id, event_type, minute, source)
);
CREATE INDEX idx_footballer_events_match ON footballer_events(match_id);
CREATE INDEX idx_footballer_events_footballer ON footballer_events(footballer_id);

-- ===== FANTASY TABLES =====

CREATE TABLE fantasy_gameweeks (
  id              SERIAL PRIMARY KEY,
  gw_number       INTEGER NOT NULL UNIQUE,              -- 1..8
  name            TEXT NOT NULL,                        -- "GW1 - Matchday 1"
  match_ids       INTEGER[] NOT NULL,
  deadline_at     TIMESTAMPTZ NOT NULL,                 -- 1h before first KO
  is_finalised    BOOLEAN NOT NULL DEFAULT false,
  finalised_at    TIMESTAMPTZ,
  stage           TEXT NOT NULL CHECK (stage IN ('GROUP','R16','QF','SF','F'))
);

CREATE TABLE fantasy_squads (
  id              SERIAL PRIMARY KEY,
  human_id        INTEGER NOT NULL REFERENCES players(id),  -- existing players table = humans
  gameweek_id     INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
  is_free_hit     BOOLEAN NOT NULL DEFAULT false,
  is_wildcard     BOOLEAN NOT NULL DEFAULT false,
  is_triple_capt  BOOLEAN NOT NULL DEFAULT false,
  is_bench_boost  BOOLEAN NOT NULL DEFAULT false,
  locked_at       TIMESTAMPTZ,                          -- when deadline passed; null = editable
  is_auto_applied BOOLEAN NOT NULL DEFAULT false,       -- default template was used
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (human_id, gameweek_id)
);

CREATE TABLE fantasy_squad_slots (
  id              SERIAL PRIMARY KEY,
  squad_id        INTEGER NOT NULL REFERENCES fantasy_squads(id) ON DELETE CASCADE,
  footballer_id   INTEGER NOT NULL REFERENCES footballers(id),
  slot_index      INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 14),
  is_starter      BOOLEAN NOT NULL,
  bench_order     INTEGER,                              -- 1..4 for bench, null for starters; bench[1] = sub-GK
  is_captain      BOOLEAN NOT NULL DEFAULT false,
  is_vice         BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (squad_id, slot_index),
  UNIQUE (squad_id, footballer_id)
);
CREATE INDEX idx_fantasy_squad_slots_squad ON fantasy_squad_slots(squad_id);

CREATE TABLE fantasy_transfers (
  id              SERIAL PRIMARY KEY,
  human_id        INTEGER NOT NULL REFERENCES players(id),
  gameweek_id     INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
  footballer_out  INTEGER NOT NULL REFERENCES footballers(id),
  footballer_in   INTEGER NOT NULL REFERENCES footballers(id),
  is_free         BOOLEAN NOT NULL,                     -- weekly free or forced-by-elimination
  is_forced       BOOLEAN NOT NULL DEFAULT false,
  cost_points     INTEGER NOT NULL DEFAULT 0,           -- -4 or 0
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fantasy_transfers_human_gw ON fantasy_transfers(human_id, gameweek_id);

CREATE TABLE fantasy_chips (
  id              SERIAL PRIMARY KEY,
  human_id        INTEGER NOT NULL REFERENCES players(id),
  chip_type       TEXT NOT NULL CHECK (chip_type IN ('WILDCARD','FREE_HIT','TRIPLE_CAPT','BENCH_BOOST')),
  gameweek_id     INTEGER REFERENCES fantasy_gameweeks(id),  -- null = available
  used_at         TIMESTAMPTZ,
  UNIQUE (human_id, chip_type)
);

CREATE TABLE fantasy_footballer_gw_points (
  id              SERIAL PRIMARY KEY,
  footballer_id   INTEGER NOT NULL REFERENCES footballers(id),
  gameweek_id     INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
  match_id        INTEGER REFERENCES matches(id),
  minutes         INTEGER NOT NULL DEFAULT 0,
  goals           INTEGER NOT NULL DEFAULT 0,
  assists         INTEGER NOT NULL DEFAULT 0,
  clean_sheets    INTEGER NOT NULL DEFAULT 0,
  conceded        INTEGER NOT NULL DEFAULT 0,
  saves           INTEGER NOT NULL DEFAULT 0,
  pen_saved       INTEGER NOT NULL DEFAULT 0,
  pen_missed      INTEGER NOT NULL DEFAULT 0,
  yellow_cards    INTEGER NOT NULL DEFAULT 0,
  red_cards       INTEGER NOT NULL DEFAULT 0,
  own_goals       INTEGER NOT NULL DEFAULT 0,
  total_points    INTEGER NOT NULL DEFAULT 0,
  scoring_tier    TEXT NOT NULL CHECK (scoring_tier IN ('LIVE','SIMPLIFIED','ADMIN')),
  is_provisional  BOOLEAN NOT NULL DEFAULT true,        -- flips false 24h post-match
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (footballer_id, gameweek_id, match_id)
);

CREATE TABLE fantasy_squad_gw_scores (
  id              SERIAL PRIMARY KEY,
  squad_id        INTEGER NOT NULL REFERENCES fantasy_squads(id),
  gameweek_id     INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
  raw_points      INTEGER NOT NULL,
  transfer_cost   INTEGER NOT NULL DEFAULT 0,
  net_points      INTEGER NOT NULL,                     -- raw - transfer_cost
  captain_id      INTEGER REFERENCES footballers(id),
  captain_played  BOOLEAN NOT NULL DEFAULT false,
  vice_activated  BOOLEAN NOT NULL DEFAULT false,
  is_provisional  BOOLEAN NOT NULL DEFAULT true,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (squad_id, gameweek_id)
);

CREATE TABLE fantasy_score_corrections (
  id              SERIAL PRIMARY KEY,
  footballer_id   INTEGER NOT NULL REFERENCES footballers(id),
  gameweek_id     INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
  reason          TEXT NOT NULL,
  before_json     JSONB NOT NULL,
  after_json      JSONB NOT NULL,
  applied_by      INTEGER REFERENCES players(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fantasy_error_log (
  id              SERIAL PRIMARY KEY,
  context         TEXT NOT NULL,
  match_id        INTEGER,
  gameweek_id     INTEGER,
  error_message   TEXT NOT NULL,
  stack           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add to existing matches table:
ALTER TABLE matches ADD COLUMN fantasy_finalised BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE matches ADD COLUMN fantasy_finalised_at TIMESTAMPTZ;
```

---

## 6. Final API route inventory

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| **Fantasy — read** | | | | |
| 1 | GET | `/api/fantasy/footballers` | session | List all footballers with price/position/nation |
| 2 | GET | `/api/fantasy/gameweeks` | session | All GWs with deadlines and finalised state |
| 3 | GET | `/api/fantasy/gameweek/current` | session | Active or upcoming GW + server epoch |
| 4 | GET | `/api/fantasy/my-squad` | session | Caller's current squad (editable or locked) |
| 5 | GET | `/api/fantasy/my-squad/[gwId]` | session | Caller's historical squad |
| 6 | GET | `/api/fantasy/squads/[gwId]` | session | All 8 squads (only if GW locked) |
| 7 | GET | `/api/fantasy/leaderboard` | session | Cumulative + per-GW table |
| 8 | GET | `/api/fantasy/locked-count` | session | "N of 8 submitted" pre-deadline |
| 9 | GET | `/api/fantasy/chips/mine` | session | Caller's chip availability |
| 10 | GET | `/api/fantasy/transfer-suggestions/[gwId]` | session | Auto-generated digest for WhatsApp |
| **Fantasy — write** | | | | |
| 11 | POST | `/api/fantasy/squad/save` | session | Save squad (validates legality, requires editable GW) |
| 12 | POST | `/api/fantasy/squad/apply-template` | session | Apply Balanced/Attacking/Safe template |
| 13 | POST | `/api/fantasy/transfer` | session | Submit a transfer for upcoming GW |
| 14 | POST | `/api/fantasy/chip/activate` | session | Activate chip for upcoming GW |
| 15 | POST | `/api/fantasy/captain` | session | Set captain + vice |
| 16 | POST | `/api/fantasy/auto-manage` | session | Toggle auto-manage |
| **Fantasy — cron** | | | | |
| 17 | GET | `/api/cron/fantasy-poll` | cron secret | Tier 1/2 ingestion |
| 18 | GET | `/api/cron/fantasy-finalise` | cron secret | Run 24h post-match: lock provisional, compute final |
| 19 | GET | `/api/cron/fantasy-deadline-protector` | cron secret | T-60min blank-squad auto-fill |
| 20 | GET | `/api/cron/fantasy-data-sanity` | cron secret | PHANTOM: flag >25pt single-player matches |
| **Admin** | | | | |
| 21 | POST | `/api/admin/fantasy/score-match` | admin | Tier 3 box-score entry |
| 22 | POST | `/api/admin/fantasy/correct-score` | admin | Apply correction (logged) |
| 23 | POST | `/api/admin/fantasy/recompute` | admin | Force full recompute of a GW |
| 24 | POST | `/api/admin/fantasy/upsert-footballer` | admin | Add/edit footballer |
| 25 | POST | `/api/admin/fantasy/kill` | admin | Flip feature flag off |
| 26 | GET | `/api/admin/fantasy/diagnostics` | admin | Tier feasibility per match |
| 27 | POST | `/api/admin/fantasy/finalise-gw` | admin | Manual GW finalise |

---

## 7. Final page/component inventory

**Pages** (all under `/fantasy/*`, gated by `FANTASY_ENABLED`):
- `/fantasy` — landing: current GW deadline countdown, "N/8 locked in", my-squad summary, leaderboard top 3
- `/fantasy/squad` — squad picker / view (editable pre-deadline, view post)
- `/fantasy/squad/build` — full picker flow (positions, budget bar, nations counter)
- `/fantasy/transfers` — transfer UI for upcoming GW
- `/fantasy/chips` — chip activation
- `/fantasy/leaderboard` — full table, per-GW breakdown
- `/fantasy/gw/[gwId]` — public view of all 8 squads + scores (post-lock only)
- `/fantasy/help` — glossary, rules, FPL primer for the 5 FPL-naive mates
- `/admin/fantasy` — admin dashboard

**Components**:
- `<DeadlineCountdown serverEpoch={n} />` — server-authoritative
- `<SquadPitch slots={..} onSelect={..} />` — visual 4-3-3 etc.
- `<BudgetBar spent={..} cap={1000} />`
- `<NationCounter picks={..} />` — flags max 3
- `<FootballerCard footballer={..} priceProvisional={false} />`
- `<TemplatePicker onApply={('balanced'|'attacking'|'safe')} />`
- `<EliminationSalvageModal />` — knockout forced transfer
- `<ProvisionalBadge until={..} />` — 24h post-match
- `<LockedInCounter count={n} of={8} />`
- `<ChipDeadAlert playingCount={n} />` — "Only N of 15 play this GW"
- `<TransferSuggestionsDigest gwId={..} />` — copy-to-clipboard for WhatsApp
- `<AutoManageToggle />`

---

## 8. Final scoring engine

**Architecture**: three-layer — Ingestion → Attribution → Aggregation. Idempotency four-layer.

**Idempotency layers**:
1. `footballer_events` UNIQUE on `(match_id, footballer_id, event_type, minute, source)` — append-only, never dedupes at write.
2. `fantasy_footballer_gw_points` UNIQUE on `(footballer_id, gameweek_id, match_id)` — full overwrite on recompute, never partial.
3. `matches.fantasy_finalised` BOOLEAN — flips true 24h post-match by cron 18; blocks live recompute thereafter.
4. `fantasy_squad_gw_scores` UNIQUE on `(squad_id, gameweek_id)` — full recompute, atomic write.

**Scoring tiers** (revised post-user-decision, 21 May — Tier 3 ADMIN removed):

- **Tier 1A LIVE (API-Football)**: cron 17 every 60s during live windows. Fetches `/fixtures/events` + `/fixtures/players`. Full FPL scoring including saves, conceded, cards. Default if Day-0 audit passes.
- **Tier 1B LIVE (Backup API)**: same scoring logic, different ingestion adapter. Candidate providers to evaluate in Day 0: **SportMonks** (`football.sportmonks.com`, well-documented, supports live per-player), **Sofascore** (semi-public, requires reverse-engineered endpoints — risk), **FotMob** (similar), **StatsBomb** (mostly historical, may not cover live WC). Adapter pattern in `src/lib/fantasy/providers/` so swap is per-deploy.
- **Tier 2 SIMPLIFIED**: cron 17 every 90s. Fetches whichever provider's events-only endpoint works. Scores: appearance (lineup-named), goals, assists, yellow/red. No saves, no CS exact-conceded (CS derived from match score + lineup-named). Used only if BOTH 1A and 1B can't provide full per-player stats.

**Tier 3 ADMIN scoring is rejected by user decision.** If by 9 June 23:59 no API combination delivers per-player data, the only remaining option is the hard-kill prediction-game mode (§10) — single-squad locked entire tournament, scored post-tournament from whatever data the API eventually publishes.

**Tier is locked at GW1 lock.** Stored as env var `FANTASY_SCORING_TIER` (`1A`/`1B`/`2`). The `scoring_tier` column exists for audit. Mid-tournament tier change requires explicit migration: full recompute + WhatsApp announcement.

**FPL scoring values**: appearance 1, 60+ min 2, GK/DEF goal 6, MID goal 5, FWD goal 4, assist 3, GK/DEF CS 4, MID CS 1, GK 3 saves 1, GK pen save 5, pen miss -2, 2 conceded GK/DEF -1, yellow -1, red -3, own goal -2. Captain ×2. Triple captain ×3. Vice activates if captain plays 0 minutes.

**Match MVP / BPS**: **OFF by default.** Feature-flagged behind `FANTASY_MVP_ENABLED`. Sign-off pending in 30-min call. If approved, top non-captain scorer per match across all 8 squads gets +3 (ties: alphabetical).

**Auto-subs**: on GW finalise. Iterate bench in `bench_order`. Bench slot 1 is sub-GK (only swaps with starter GK if GK plays 0 min). Slots 2-4 swap with non-playing outfielders while maintaining formation minimums (1 GK / ≥3 DEF / ≥1 FWD).

**Captain fallback**: 1 level only. Captain plays 0 min → vice gets multiplier. Both 0 min → no multiplier.

**Data sanity gate** (PHANTOM): cron 20 flags any single-player >25-point match as "needs admin review". Score still posts but `is_provisional` stays true for 48h instead of 24h.

---

## 9. Final pricing model

**Formula** (deterministic, in `scripts/price-footballers.ts`):

```
price = position_floor[pos]
      + nation_tier_bonus[nation]
      + star_bonus[full_name] || 0
      + position_premium[pos] if star_bonus > 0
```

**Position floors**: GK 4.0, DEF 4.0, MID 4.5, FWD 4.5.

**Nation tiers** (manual JSON, ARBITER-chosen, 4 tiers):
- T1 (+3.0): BRA, FRA, ENG, ARG, ESP, POR, GER
- T2 (+1.5): NED, BEL, ITA, URU, CRO, MAR
- T3 (+0.5): SUI, USA, MEX, SEN, JPN, KOR, CAN, ECU, COL, AUS
- T4 (+0): everyone else

**Star bonus** (manual JSON, ~25 names): Mbappé +3.5, Haaland +3.5, Bellingham +2.5, Vinicius +2.5, Salah +2.0, Kane +2.0, Saka +1.5, Foden +1.5, Lautaro +1.5, Rodri +1.5, Pedri +1.0, Yamal +1.5, Musiala +1.5, Wirtz +1.0, Osimhen +1.5, Felix +0.5, Doku +1.0, Theo Hernandez +1.0, Van Dijk +1.0, Alisson +1.5, Courtois +1.5, Donnarumma +1.5, Cancelo +0.5, Dias +1.0, Rüdiger +0.5.

**Position premium** if starred: GK +0.5, DEF +0.5, MID +1.0, FWD +1.5.

**Validation**: must yield ≥100 footballers at ≤5.0, ≤25 at ≥10.0, total possible cheapest XI ≤ 70.0. Script fails CI if not.

**Price changes**: **NONE in-tournament.** Locked at GW1.

---

## 10. Final fallback plan

**Dated trigger cascade**:

| Date | Trigger | Action |
|---|---|---|
| T-14 (28 May) | Day 0 audit complete | Determine starting tier feasibility, document |
| T-10 (1 Jun) | Friendly window observation | Re-run audit on real WC squads; tier prediction |
| T-7 (4 Jun) | Warmup friendly | Run scoring against live friendly; sign off on tier |
| T-2 (9 Jun) | 64 fixtures scheduled in API | Hard kill gate: if no fixtures, ship as prediction game |
| GW1 finalise | LIVE scoring within 65min? | Decision point on Tier 2 fallback or Tier 3 commit |
| Per match | data sanity (>25pt) | Auto-extend provisional window 48h |
| Per match | "API up but wrong" check | Cron 20 cross-references events count vs match score; mismatch = admin review |

**Hard kill (revised post-user-decision)**: 9 June 23:59 — if NEITHER API-Football Tier 1A, NOR backup Tier 1B, NOR Tier 2 SIMPLIFIED via any provider works, fantasy launches as **prediction game**: each player submits single 15-man squad locked entire tournament, scored post-tournament from API data once it eventually publishes. No transfers, no chips, no live. No manual admin entry (user-rejected). Honest degradation, still playable.

---

## 11. Final 21-day plan

Working day 1 = Thursday 22 May. Target launch = Wednesday 10 June (24h buffer before 11 June 19:00 UTC deadline).

| Day | Date | Tasks | Hours | Depends on |
|---|---|---|---|---|
| **D0** | Thu 22 May | API audit per §3 (NOW INCLUDES backup-provider evaluation: SportMonks + Sofascore + FotMob ≥30min each). Write `/docs/fantasy/day0-audit.md`. Schedule 30-min call. If API-Football WC 2026 coverage NO-GO, Day 0 deliverable also includes integration estimate for top backup. | 6 | — |
| **D1** | Fri 23 May | 30-min call with 8 humans (§15). Lock open questions. Read existing `poll-matches.ts`. | 4 | D0 |
| **D2** | Sat 24 May | Schema migration `0001_fantasy_init.sql`. Drizzle types. Rollback script. Feature flag wiring. Sibling-route middleware. | 8 | D1 |
| **D3** | Sun 25 May | Seed `footballers` — scrape 23-man squads (provisional, may need refresh post 1 Jun cutoff). `scripts/price-footballers.ts` v1. Validation gate. | 8 | D2 |
| **D4** | Mon 26 May | Seed `fantasy_gameweeks` from fixture schedule. Server-authoritative `DeadlineCountdown`. Default squad templates JSON (Balanced/Attacking/Safe). | 6 | D3 |
| **D5** | Tue 27 May | Server-side squad validation (15 players, budget, 3/nation, position counts, no dup). Unit tests for all rejection paths. | 8 | D4 |
| **D6** | Wed 28 May | `/fantasy/squad/build` UI: pitch, picker, budget bar, nation counter. iPhone Safari first. | 8 | D5 |
| **D7** | Thu 29 May | Squad picker validation E2E with 2 humans. Captain/vice UI. Bench ordering UI. | 8 | D6 |
| **D8** | Fri 30 May | Template-apply flow. Auto-manage toggle. Blank-squad protector cron (cron 19). | 6 | D7 |
| **D9** | Sat 31 May | Refresh footballer seed against finalised 23-man squads (FIFA cutoff is 1 Jun). `processFantasyEvents(match)` skeleton wrapped in try/catch in `poll-matches.ts`. | 8 | D8 |
| **D10** | Sun 1 Jun | Scoring engine: attribution from `footballer_events` → `fantasy_footballer_gw_points`. FPL values constants. Unit tests every event type. | 10 | D9 |
| **D11** | Mon 2 Jun | Squad scoring: aggregation, captain logic, vice fallback, auto-subs. Bench Boost / Triple Captain / Free Hit chip math. | 10 | D10 |
| **D12** | Tue 3 Jun | Transfers UI + logic. Free transfer banking. -4 cost. Forced KO transfer = free. | 8 | D11 |
| **D13** | Wed 4 Jun | **Test against live friendly** (international window). Tier 1/2 decision. Wildcard chip. Chip activation UI. ChipDeadAlert. | 10 | D12 |
| **D14** | Thu 5 Jun | Leaderboard page. `/fantasy/gw/[gwId]` public view. Locked-in counter. Transfer suggestions digest. | 8 | D13 |
| **D15** | Fri 6 Jun | Admin: score-match Tier 3 form. Correct-score with audit. Recompute. Diagnostics page. Cron 20 data-sanity. Provisional badge. | 8 | D14 |
| **D16** | Sat 7 Jun | Full path test: 2 humans submit squad → cron polls → scores compute → leaderboard updates → transfer → next GW. | 8 | D15 |
| **D17** | Sun 8 Jun | **Dress rehearsal**: replay 2024 Euros match through scoring engine. All 8 humans submit dummy squads. Fix bugs surfaced. | 10 | D16 |
| **D18** | Mon 9 Jun | **Fallback decision gate** (T-2). Lock scoring tier. Fix all P0/P1 bugs from rehearsal. Help page. Onboarding tooltips for FPL-naive. | 10 | D17 |
| **D19** | Tue 10 Jun | **Stabilisation buffer** (12h). Production deploy. Smoke test. Open `/fantasy/squad` to 8 humans for real squad entry. WhatsApp announce. | 8 | D18 |
| **D20** | Wed 11 Jun | **Stabilisation buffer** (12h). Monitor squad submissions. Blank-squad protector fires at 18:00 UTC. Final smoke. **19:00 UTC LOCK.** | 8 | D19 |
| **D21** | Thu 12 Jun | GW1 live observation. Bugfix. Buffer for cron-failure interventions. | 8 | D20 |

Total: ~166 hours. Single dev at ~8h/day = realistic with 18h slip room.

---

## 12. Final risk register

| # | Risk | Impact | Likelihood | Mitigation | Source |
|---|---|---|---|---|---|
| 1 | API-Football `/fixtures/players` never populates for WC 2026 | Critical | High | Tier 1B backup-provider switch (SportMonks etc); Tier 2 SIMPLIFIED; 9 Jun hard kill to prediction-game | Brief, CONTRARIAN, FIRST PRINCIPLES, User 21 May |
| 1B | NO backup API provider offers full per-player WC 2026 stats at acceptable cost | Critical | Medium | Day 0 audit evaluates ≥3 backups; if all fail, hard-kill to prediction game (user-mandated, no manual admin) | User 21 May |
| 2 | Polling burst-cost 429s during 4-match group windows | High | Medium | Backoff documented Day 0; staggered cron windows; cache /fixtures call | ANVIL |
| 3 | Drizzle migration breaks existing sweep | Critical | Low | No rename; isolation §2; rollback script; staging test | PHANTOM |
| 4 | 03:00 UK kickoff = nobody pushes deadline | High | High | Auto-template at T-60min; WhatsApp ping cron | PHANTOM |
| 5 | 5/8 mates never played FPL, disengage by GW3 | High | High | Help page, templates, auto-manage, onboarding tooltips | PHANTOM |
| 6 | Blank squads at deadline | High | High | Cron 19 applies Balanced template + ping | PHANTOM |
| 7 | Squad picker validation edge cases | High | High | Day 7 E2E with 2 humans; full unit coverage Day 5 | ANVIL |
| 8 | Sweep poller fetches not what EXECUTOR assumes | High | Medium | Day 0 audit; resolved before D9 | ANVIL |
| 9 | API returns 200 with null/wrong data ("up but wrong") | High | Medium | Cron 20 sanity gate; 48h provisional window on flagged matches | PHANTOM |
| 10 | ~~Admin Tier 3 operator unnamed~~ — N/A, Tier 3 rejected by user 21 May | — | — | Replaced by Risk 1B (backup API evaluation) | CONTRARIAN, ANVIL, User |
| 11 | Tier switching mid-tournament produces non-commensurable scores | High | Low | Tier locked at GW1; column for audit only | ANVIL |
| 12 | Knockout chip degeneracy (5 Brazilians out → Bench Boost dead) | Medium | Medium | ChipDeadAlert warns "N/15 playing"; user takes risk | PHANTOM |
| 13 | Server-client clock drift, deadline missed | High | Medium | Server-authoritative epoch on every page | PHANTOM |
| 14 | Score corrections produce silent reorder | Medium | Medium | `fantasy_score_corrections` audit table; admin "dispute" button | PHANTOM |
| 15 | Squad lock leaks pre-deadline | Medium | Low | N-of-8 only; squad content not in any pre-lock response | PHANTOM |
| 16 | Footballer pool changes post-seed (injuries, FIFA squad amendments) | Medium | High | Admin upsert endpoint; auto-notice WhatsApp | FIRST PRINCIPLES |
| 17 | Engagement collapse (race becomes 2-player by GW3) | Medium | Medium | Auto-manage keeps disengaged on board; transfer digest | PHANTOM |
| 18 | Cron job silent failure | High | Medium | Per-mutation `locked_at` server-side; admin diagnostics page | FIRST PRINCIPLES |
| 19 | Pick-early vs pick-late info asymmetry | Low | Certain | Accept as feature; T-60min reminder ping to laggards | PHANTOM |
| 20 | Lineup-confirmation cascade post-deadline | Medium | High | Auto-subs robust; vice fallback; "0 min = bench triggers" | PHANTOM |

---

## 13. Kill criteria (ordered drop list)

Drop in this order if behind schedule.

1. Match MVP / BPS (default already off — confirms ship)
2. Transfer Suggestions Digest (manual WhatsApp instead)
3. `/fantasy/help` page (replace with single README link)
4. Auto-manage toggle (auto-template at deadline still fires)
5. Chips beyond Wildcard (drop FH, TC, BB)
6. Public squads view `/fantasy/gw/[gwId]` (post-launch addition)
7. Knockout salvage modal (basic forced transfer UI suffices)
8. Score corrections audit UI (admin uses SQL directly)
9. Data-sanity cron 20 (manual admin review)
10. Onboarding tooltips (drop, accept 5/8 confusion)
11. Default templates Attacking/Safe (keep only Balanced)
12. Wildcard chip (transfers still work without)
13. Leaderboard per-GW breakdown (cumulative only)
14. **HARD KILL**: prediction-game mode (single squad, post-tournament scoring)

Items 1-7 are pre-emptively droppable Day 13 if any day slipped >0.5d cumulative. Items 8-13 are emergency drops Day 17-18.

---

## 14. Open decisions for the user — RESOLVED 21 May 2026

All five decisions resolved. Recorded in §4 above.

1. ~~Tier 3 admin operator~~ → **REJECTED.** No manual admin scoring; must use APIs. Day 0 audit expanded to evaluate backup providers (SportMonks, Sofascore, FotMob, StatsBomb). Hard kill remains prediction-game if no API works.
2. ~~Match MVP / BPS~~ → **Dropped entirely**, no bonus points.
3. ~~Prize structure~~ → **Separate £40 fantasy pot, winner-takes-all.**
4. ~~Public squads at deadline lock~~ → **Yes, public at deadline lock.**
5. ~~Knockout free-transfer cap~~ → **Unlimited free for players of eliminated nations only.**

---

## 15. The 30-minute call (Friday 23 May, agenda — revised post-decisions)

Most decisions now resolved. The call is shorter and primarily informational + commitment-confirmation.

**Attendees**: all 8 humans. WhatsApp video, 19:00 UK.

**Pre-read** (sent 24h prior): one-page rules summary (no BPS, unlimited KO transfers for eliminated, £5 pot), screenshot of squad picker mockup, link to FPL primer for novices.

**Agenda** (strict timing, ~15 min):

- **0:00-0:03 — Frame**: "Adding fantasy to the sweep. 3 weeks. Sweep is canon, fantasy is for banter. Separate £40 pot, winner takes all."
- **0:03-0:08 — Confirm commitment**: "Who is in? Need 6/8 minimum. Hands up." If <6 → drop to prediction game.
- **0:08-0:11 — Inform of locked rules**: scoring is pure FPL (goals/assists/CS/cards/saves) with no BPS; 1 Wildcard + 3 chips; squads public at deadline; auto-template applies if no submission by T-60min; unlimited free transfers for players of eliminated nations.
- **0:11-0:13 — £5 pot collection**: confirm everyone pays in, agree pot custodian.
- **0:13-0:15 — Hard-kill consent**: "If neither API-Football nor a backup API delivers live per-player data, fantasy degrades to single-squad prediction game scored from final tournament stats. Acceptable as last resort?" Need explicit yes.
- Skip: Tier 3 admin volunteer (rejected), Match MVP vote (dropped), public-squads debate (locked), KO cap debate (locked).

**Decisions logged** in `/docs/fantasy/call-23may.md`, committed to repo, linked from CLAUDE.md.

---

**End of Final Plan. Day 0 starts now.**
