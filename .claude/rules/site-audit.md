# Full Site Audit

When the user says "full audit", "site audit", "audit the site", "pre-tournament audit", or "check everything", execute this protocol before doing anything else.

The site is at `/home/user/Mkts/golf-sweep`. It's a live golf sweepstake app used by 8 real people. Read AGENTS.md first.

**DO NOT GUESS. DO NOT SKIM. Read actual data, trace actual code, compare actual strings.**

## Step 1: API Endpoint Verification

Check every API route file exists and exports the correct HTTP methods:

```bash
cd /home/user/Mkts/golf-sweep
for endpoint in \
  "leaderboard" "full-leaderboard" "heatmap" "trajectory" \
  "banter" "predictions" "hot-takes" "season" "season-trajectory" \
  "records" "scorecards" "hole-by-hole" "health-check" "widget" \
  "player" "yearbook" "archive" "rivalry" "draft/status" "draft/pick" \
  "admin/activate-tournament" "admin/mark-tournament-finished" \
  "admin/mark-round-complete" "admin/set-passcode" "admin/bulk-picks" \
  "admin/override" "commissioner/action" "commissioner/actions" \
  "chat/history" "chat/send" "chat/react" "seed"; do
  f="src/app/api/${endpoint}/route.ts"
  if [ -f "$f" ]; then echo "✅ $endpoint"; else echo "❌ MISSING: $f"; fi
done
```

## Step 2: TypeScript Compilation

```bash
cd /home/user/Mkts/golf-sweep && npx tsc --noEmit 2>&1
```

Report ALL errors. Do not dismiss any as "just recharts".

## Step 3: Data Flow Consistency

Read these files and for EACH one, answer:
- What tournament does it select? (live? hardcoded ID? parameter?)
- How does it match golfer names? (normalizeGolferName? slashPlayerId? both?)
- How does it sort by position? (does parseInt have `|| 999` for CUT/WD/DQ?)
- Does it handle BSON-wrapped values from Slash Golf?

Files to check:
1. `src/app/api/leaderboard/route.ts`
2. `src/app/api/full-leaderboard/route.ts`
3. `src/app/api/heatmap/route.ts`
4. `src/app/api/scorecards/route.ts`
5. `src/app/api/hole-by-hole/route.ts`
6. `src/app/api/trajectory/route.ts`
7. `src/app/api/predictions/route.ts`
8. `src/app/api/banter/route.ts`
9. `src/lib/banter-engine.ts`
10. `src/lib/complete-round.ts`

## Step 4: Hardcoded Values Sweep

```bash
cd /home/user/Mkts/golf-sweep

# Hardcoded tournament ID
grep -rn 'tournamentId.*=.*1\b' src/app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "?? 1" | grep -v "|| 1" | grep -v "interface\|type "

# Hardcoded Masters references in non-banter code
grep -rn "Masters\|Augusta\|green jacket\|Amen Corner\|azalea" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v seed-data | grep -v "banter.ts" | grep -v "TournamentLogo" | grep -v "scoring/page"

# Hardcoded year
grep -rn ", 2026)" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# Hardcoded golfer names that won't exist in next tournament
grep -rn "GOLFER_SURNAMES\|hardcoded.*golfer" src/ --include="*.ts" | grep -v node_modules
```

## Step 5: Position Sort Safety

Every `parseInt` on a position string MUST have `|| 999` to handle "CUT"/"WD"/"DQ" returning NaN:

```bash
cd /home/user/Mkts/golf-sweep
grep -rn "parseInt.*position\|parseInt.*replace.*T" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Check each match. If any line does NOT have `|| 999` or `isNaN` handling, flag it.

## Step 6: Cache and Poll Intervals

```bash
grep -rn "60_000\|60000\|CACHE_TTL\|POLL_INTERVAL\|setInterval" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

All server caches should be ≤30s. All client polls should be ≤30s.

## Step 7: Stale One-Shot Migrations

Read `src/db/ensure-tables.ts` and check for any try/catch blocks that are one-shot data migrations (DELETE, UPDATE, INSERT that aren't CREATE TABLE/INDEX). These should be removed after they've run.

## Step 8: Dead Code

```bash
cd /home/user/Mkts/golf-sweep

# Unused imports
grep -rn "import.*from" src/app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | head -50

# References to removed features
grep -rn "matchday\|football\|sofascore\|odds.*api\|oddsArrow" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# Duplicate function definitions
grep -rn "function formatScore\|function scoreColor\|function parseScore" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

## Step 9: Health Check Endpoint

Read `src/app/api/health-check/route.ts` and verify it checks:
1. Live tournament exists
2. slashTournId is set
3. All 8 players have picks
4. 4 rounds exist
5. Slash Golf API responds
6. No duplicate golfers
7. Points log integrity
8. Exactly 1 live tournament

## Step 10: Nav Links

Read `src/components/Nav.tsx` and verify every `href` points to an existing page in `src/app/`.

## Step 11: Report

Format findings as:

| # | Check | Status | Issue | File:Line |
|---|-------|--------|-------|-----------|
| 1 | API endpoints | ✅/❌ | details | path |
| 2 | TypeScript | ✅/❌ | details | path |
| ... | ... | ... | ... | ... |

Then list:
- **CRITICAL** — will break the site for users
- **HIGH** — will show wrong data
- **MEDIUM** — will confuse users
- **LOW** — cosmetic or code quality

End with a clear YES/NO: "Is the site ready for users?"
