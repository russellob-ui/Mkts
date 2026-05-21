# Day 0 Audit — API-Football per-player data + backup providers

Per FINAL_PLAN.md §3. Mandatory before D9 (poll-matches.ts extension).

## How to run

1. Deploy this branch.
2. Hit `https://mkts-dun.vercel.app/api/admin/api-check`.
3. Paste the JSON response into the **"Raw response"** section below.
4. Fill in the **"Findings"** section based on what the probe returned.

The api-check endpoint now also runs a probe against a recent finished international friendly (`league=10` in API-Football). It fetches `/fixtures/events`, `/fixtures/lineups`, `/fixtures/players` against that fixture. If those return populated data, API-Football CAN deliver per-player stats — it's just gated on tournament activation for WC 2026. If they return empty, the API itself can't do it and we must switch to a backup provider.

## Raw response

_paste `/api/admin/api-check` JSON output here_

## Findings — API-Football

- [ ] WC 2026 `events` flag (from `leagueSearch.sample` coverage): **TBD**
- [ ] WC 2026 `lineups` flag: **TBD**
- [ ] WC 2026 `statistics_players` flag: **TBD**
- [ ] `fantasyProbe_fixtureId` (which recent friendly was used): **TBD**
- [ ] `fantasyProbe_events.results` count: **TBD**
- [ ] `fantasyProbe_events.sample[0].player.id` populated? **TBD**
- [ ] `fantasyProbe_lineups.results` count + `startXI` populated? **TBD**
- [ ] `fantasyProbe_players.results` count + per-player stats schema? **TBD**

**Verdict on Tier 1A (API-Football LIVE)**: GO / NO-GO

## Backup provider evaluation

User decision 21 May 2026: NO manual admin scoring. If Tier 1A fails, must use a backup API.

### SportMonks Football API
- Docs: https://docs.sportmonks.com/football/welcome
- WC 2026 coverage: TBD (request demo)
- Per-player live stats: TBD
- Pricing: TBD
- Integration estimate: TBD

### Sofascore (semi-public)
- ToS risk: TBD
- Endpoint: `api.sofascore.com/api/v1/event/{id}/lineups` (reverse-engineered)
- Per-player live stats: TBD
- Integration estimate: TBD

### FotMob
- Endpoint: `www.fotmob.com/api/matchDetails?matchId={id}` (semi-public)
- ToS risk: TBD
- Per-player live stats: TBD
- Integration estimate: TBD

### StatsBomb Open Data
- Coverage: historical-only typical; WC 2026 live coverage unlikely
- TBD

## Recommendation

_Fill in after audit complete. Decide:_
1. Proceed with Tier 1A (API-Football LIVE) — most likely if probe shows populated per-player data.
2. Proceed with Tier 1B (backup provider X) — if Tier 1A NO-GO, name the chosen backup + integration estimate.
3. Hard kill to prediction-game mode — only if no API can deliver per-player WC 2026 data by 9 June 23:59.

## Existing poller audit

`src/lib/poll-matches.ts` currently fetches:
- TBD: list of API-Football endpoints already in use
- TBD: poll interval
- TBD: whether `/fixtures/events` already retrieved (cost to add fantasy = zero if so)

## Burst cost estimate

Group-stage matchdays have up to 4 simultaneous matches.

- Tier 1A peak: 4 matches × 60s polling × 2 endpoints = **TBD calls/min, TBD/day**
- Daily quota: 7,500
- Safety margin: TBD

## Sign-off

- [ ] Tier locked: **TBD**
- [ ] Backup provider selected (if applicable): **TBD**
- [ ] Integration ready to start D9: **TBD**
- [ ] No-go date if conditions not met: 9 June 2026 23:59 UTC
