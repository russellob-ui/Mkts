# MKTS Frontend Architecture — Final Implementation Plan
*Architect B (Clean Architecture) selected | April 2026*

---

## Design Principles (from Contrarian Research)

1. Dark-mode default
2. Command bar (Cmd+K) as primary navigation
3. Dense tables + tiled panels, NOT card widget grids
4. Desktop-first (1440px+), separate mobile companion
5. Embedded AI (annotations, command bar, briefs) — NO chat page
6. Treemaps for allocation, radar charts for quality — NO donut/pie
7. Switchable spaces (Monitor/Research/Portfolio/Macro)
8. Structured density — Bloomberg-approachable
9. UK tax-wrapper intelligence (ISA/SIPP/GIA, CGT, bed-and-ISA)
10. Inter font, Indigo accent, Emerald/Red for gains/losses

---

## Stack (confirmed from actual code)

- **Framework:** Next.js 16.2.2 (App Router)
- **React:** 19.2.4
- **Styling:** Tailwind CSS 4 + PostCSS
- **State:** Zustand v5 (UI) + TanStack React Query v5 (server)
- **Charts:** lightweight-charts v5 (OHLCV) + recharts v3 (treemaps, radar, bars)
- **UI Primitives:** Radix UI (dialog, dropdown, scroll-area, separator, tooltip)
- **Command Palette:** cmdk
- **Grid:** react-grid-layout (deferred to phase 2)
- **Icons:** lucide-react

---

## Known Bugs to Fix

1. **WebSocket protocol mismatch:** `useWebSocket.ts` sends `{type: "subscribe"}` but backend expects `{action: "subscribe"}`
2. **Sidebar state desync:** `Sidebar.tsx` uses local `useState` while `uiStore` tracks `sidebarCollapsed` — must use store only
3. **Dark mode never activates:** `uiStore` tracks `theme` but nothing sets `class="dark"` on `<html>`
4. **Tailwind 3 syntax in Tailwind 4:** `globals.css` uses `@tailwind base` instead of `@import "tailwindcss"`
5. **WS doesn't send change/changePct:** Backend only sends `price` + `volume` — must derive change from `previousClose`
6. **Session header missing:** `api.ts` doesn't inject `X-Session-Id` — portfolio/watchlist data not session-scoped

---

## Design Tokens

```css
/* Dark-first tokens in globals.css */

--color-bg-base:          #0A0B0F    /* near-black page bg */
--color-bg-surface:       #111318    /* panel background */
--color-bg-elevated:      #181B23    /* card/row hover */
--color-bg-overlay:       #1E222D    /* dropdown/modal */

--color-border-subtle:    #1F2330    /* between panels */
--color-border-default:   #2A2F3E    /* input borders */
--color-border-strong:    #3A4055    /* active states */

--color-text-primary:     #E8EAED    /* main content */
--color-text-secondary:   #8B92A5    /* labels, meta */
--color-text-muted:       #4B5268    /* disabled */

--color-accent:           #6366F1    /* Indigo 500 */
--color-accent-dim:       #312E81    /* Indigo 900 bg */
--color-accent-bright:    #818CF8    /* Indigo 400 hover */

--color-gain:             #10B981    /* Emerald 500 */
--color-gain-dim:         #064E3B    /* Emerald 900 bg */
--color-loss:             #EF4444    /* Red 500 */
--color-loss-dim:         #450A0A    /* Red 900 bg */
--color-neutral:          #6B7280    /* Gray 500 */
--color-warn:             #F59E0B    /* Amber 500 */

--font-sans:              'Inter', system-ui
--font-mono:              'JetBrains Mono', 'Fira Code', monospace

--panel-gap:              8px
--row-height-sm:          32px       /* dense table rows */
--row-height-md:          40px       /* standard rows */
--topbar-height:          44px
--sidebar-width:          192px
--sidebar-collapsed-width: 48px
```

Font scale: 10px (label-xs), 11px (label), 12px (body-sm), 13px (body), 14px (body-md), 16px (heading), 20px (stat-lg). All numbers use `tabular-nums`.

Light mode overrides all tokens via `.light` class (secondary priority).

---

## Type System

### `src/types/market.ts`
```typescript
export interface Quote {
  ticker: string
  name: string
  price: number
  change: number
  changePct: number
  currency: 'GBP' | 'GBX' | 'USD' | 'EUR' | string
  marketState: 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | null
}

export interface CompanyDetail extends Quote {
  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  dividendYield: number | null
  volume: number | null
  averageVolume: number | null
  open: number | null
  dayHigh: number | null
  dayLow: number | null
  previousClose: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  sector: string | null
  industry: string | null
  country: string | null
  website: string | null
  longBusinessSummary: string | null
}

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MonitorItem {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePct: number | null
  dayChangePct: number | null
  weekChangePct: number | null
  monthChangePct: number | null
}
```

### `src/types/portfolio.ts`
```typescript
export type TaxWrapper = 'ISA' | 'SIPP' | 'GIA'

export interface Holding {
  ticker: string
  name: string
  shares: number
  price: number
  change: number
  changePct: number
  marketValue: number
  marketValueGBP: number | null
  weight: number
  dayPnL: number
  costBasis: number | null
  sector: string | null
  country: string | null
  currency: string
  account: TaxWrapper | string | null
  dividendRate: number | null
  dividendYield: number | null
}

export interface Exposure { label: string; weight: number }

export interface Portfolio {
  holdings: Holding[]
  totalValue: number
  totalValueGBP: number | null
  dayPnL: number
  dayPnLGBP: number | null
  dayChangePct: number
  portfolioYield: number | null
  holdingsCount: number | null
  sectorExposure: Exposure[]
  countryExposure: Exposure[]
  currencyExposure: Exposure[]
  topWinners: Holding[]
  topLosers: Holding[]
  concentration: { normalizedHHI: number; effectivePositions: number; top3Weight: number }
  benchmark: { portfolioChangePct: number; benchmarkChangePct: number; benchmarkName: string }
}
```

### `src/types/financials.ts`
```typescript
export interface FinancialPeriod {
  period: string
  revenue: number | null
  grossProfit: number | null
  operatingIncome: number | null
  netIncome: number | null
  epsBasic: number | null
  totalAssets: number | null
  totalDebt: number | null
  cashAndCashEquivalents: number | null
  totalEquity: number | null
  operatingCashFlow: number | null
  capitalExpenditure: number | null
  freeCashFlow: number | null
  dividendsPaid: number | null
}

export interface FinancialAnalytics {
  operatingMargin: number | null
  netMargin: number | null
  grossMargin: number | null
  roe: number | null
  debtToEquity: number | null
  freeCashFlowMargin: number | null
  revenueGrowth: number | null
  netIncomeGrowth: number | null
}

export interface Financials {
  ticker: string
  currency: string | null
  periods: FinancialPeriod[]
  analytics: FinancialAnalytics | null
}
```

### `src/types/news.ts`
```typescript
export interface NewsArticle {
  title: string
  description: string | null
  source: string | null
  publishedAt: string | null
  url: string | null
  sentimentScore: number | null
  entities: Array<{ symbol: string | null; name: string | null; sentimentScore: number | null }>
}
```

### `src/types/ai.ts`
```typescript
export interface Brief {
  label: string
  mode: 'concise' | 'detailed'
  bullets: string[]
  sections: Array<{ heading: string; content: string }> | null
  generatedAt: string | null
}
```

### `src/types/ws.ts`
```typescript
export interface PriceTick {
  ticker: string
  price: number
  change: number
  changePct: number
  volume: number | undefined
  timestamp: number
}
```

---

## Store Architecture

### uiStore (replace existing)
```
theme: 'dark' | 'light'          (persist, default 'dark')
sidebarCollapsed: boolean         (persist)
commandPaletteOpen: boolean
activeTicker: string | null
activeSpace: 'monitor' | 'research' | 'portfolio' | 'macro'  (persist)
alertPanelOpen: boolean
+ setters and toggles for each
```

### priceStore (extend existing)
```
prices: Record<string, PriceTick>
previousCloses: Record<string, number>   (seeded from REST quotes)
connected: boolean
subscribedTickers: Set<string>
+ updatePrice, getPrice, setPreviousClose, setConnected
```

### watchlistStore (new, persisted)
```
tickers: string[]                 (optimistic local copy)
+ add, remove, setTickers
```

### alertStore (new)
```
alerts: Alert[]
unreadCount: number
+ addAlert, removeAlert, setAlerts, markAllRead
```

**Rule:** React Query owns server state. Zustand owns UI state + real-time ticks + optimistic copies.

---

## Component Taxonomy (5-tier)

### Tier 1 — Primitives (`src/components/primitives/`)
Pure presentational, zero data fetching.

Badge, ChangeCell, CurrencyValue, DataRow, DensityTable, MiniChart, Panel, PanelHeader, Pill, Skeleton, StatusDot, Ticker, Tooltip

### Tier 2 — Compounds (`src/components/compounds/`)
Composed from primitives. Accept data props, no fetching.

AlertBell, AlertForm, AlertList, BriefPanel, CandleChart, ExposureTreemap, FinancialsTable, FundamentalsBlock, HoldingsTable, MarketTable, NewsStream, PeerTable, PortfolioSummaryBar, QualityRadar, QuoteHeader, SearchResults, TaxWrapperBar, TimeframeSelector, WatchlistTable

### Tier 3 — Features (`src/components/features/`)
Data-fetching components. Each owns one React Query call.

alerts/AlertsFeature, brief/BriefFeature, chart/ChartFeature, company/CompanyFeature, financials/FinancialsFeature, macro/MacroFeature, monitor/MarketMonitorFeature, markets/MarketsFeature, news/NewsFeature, peers/PeersFeature, portfolio/PortfolioFeature, watchlist/WatchlistFeature

### Tier 4 — Layout (`src/components/layout/`)
Shell and navigation.

Sidebar, TopBar, BottomNav, SpaceLayout, CommandPalette, AlertPanel

### Tier 5 — Pages (`src/app/`)
Next.js route segments. Thin — compose feature components inside SpaceLayout.

---

## Layout System

### Shell
```
<html class="dark">
  <body class="bg-bg-base">
    <QueryProvider>
      <Sidebar />                    fixed left, w-[192px] / w-[48px]
      <div ml-[192px]>
        <TopBar />                   fixed top, h-[44px]
        <main pt-[44px]>
          <SpaceLayout space={activeSpace}>
            {page children}
          </SpaceLayout>
        </main>
      </div>
      <CommandPalette />
      <AlertPanel />                 slide-over from right
    </QueryProvider>
  </body>
</html>
```

### Panel Grid per Space
```
Monitor:    [watchlist-col | market-monitor-col | news-col]
Research:   [chart-main (70%) | sidebar-panels (30%)]
Portfolio:  [summary-strip] / [holdings | allocation | tax-panel]
Macro:      [indicators-grid] / [chart-panel | brief-panel]
```

Each panel: `<Panel>` with `overflow-y-auto`, `height: calc(100vh - 44px)`, independent scrolling (Bloomberg-style).

### Space Routes
```
/                    → Monitor space
/research/[ticker]   → Research space
/portfolio           → Portfolio space
/macro               → Macro space
/settings            → Settings
```

---

## Query Hooks (`src/hooks/queries/`)

| Hook | Query Key | Endpoint | staleTime |
|------|-----------|----------|-----------|
| useCompanyQuery | ['company', ticker] | GET /api/company | 60s |
| useChartQuery | ['chart', ticker, period] | GET /api/charts | 300s |
| usePortfolioQuery | ['portfolio'] | GET /api/portfolio/holdings | 30s |
| useFinancialsQuery | ['financials', ticker] | GET /api/financials | 3600s |
| usePeersQuery | ['peers', ticker] | GET /api/peers | 600s |
| useNewsQuery | ['news', ticker?] | GET /api/news | 120s |
| useMarketsQuery | ['markets'] | GET /api/markets | 60s |
| useMarketMonitorQuery | ['market-monitor'] | GET /api/market-monitor | 30s (refetchInterval) |
| useMacroQuery | ['macro'] | GET /api/macro/snapshot | 3600s |
| useWatchlistQuery | ['watchlist'] | GET /api/db/watchlist | 30s |
| useAlertsQuery | ['alerts'] | GET /api/db/alerts | 30s |
| useBriefQuery | ['brief', ticker?] | GET /api/brief | 300s |
| useSearchQuery | ['search', q] | GET /api/search | 30s |

Mutation hooks: `useWatchlistMutations`, `useAlertMutations` (optimistic updates + invalidation).

---

## Data Flow

### Monitor Space
```
page.tsx mounts
  → MarketMonitorFeature: useMarketMonitorQuery() → GET /api/market-monitor
  → WatchlistFeature: useWatchlistQuery() → GET /api/db/watchlist
      → useWebSocket(watchlistTickers) → priceStore (live overlay)
  → NewsFeature: useNewsQuery() → GET /api/news
  → BriefFeature: useBriefQuery() → GET /api/brief
```

### Research Space
```
page.tsx extracts ticker → sets uiStore.activeTicker
  → CompanyFeature → GET /api/company → QuoteHeader + FundamentalsBlock
      → seeds priceStore.previousCloses[ticker]
  → ChartFeature → GET /api/charts → CandleChart (lightweight-charts)
  → FinancialsFeature → GET /api/financials → FinancialsTable + QualityRadar
  → PeersFeature → GET /api/peers → PeerTable
  → NewsFeature → GET /api/news?ticker=X → NewsStream
  → useWebSocket([ticker]) → live price in QuoteHeader
```

### Portfolio Space
```
page.tsx mounts
  → PortfolioFeature → GET /api/portfolio/holdings
      → HoldingsTable, ExposureTreemap (sector/country/currency)
      → PortfolioSummaryBar, TaxWrapperBar
  → useWebSocket(holdingTickers) → live price overlay
```

### Command Palette
```
User types "SHE" → useSearchQuery("SHE") → GET /api/search?q=SHE (debounced 300ms)
  → SearchResults renders matches
  → User selects SHEL → router.push('/research/SHEL') + setActiveTicker('SHEL')
```

### WebSocket (corrected)
```
useWebSocket(tickers)
  → send {action: "subscribe", tickers}     // fixed from 'type'
  → receive {type: "price", ticker, price, volume}
  → derive change from priceStore.previousCloses[ticker]
  → priceStore.updatePrice({ticker, price, change, changePct, volume, timestamp})
```

---

## Complete File Structure

```
frontend/src/
├── app/
│   ├── globals.css                          REWRITE (dark-first tokens, @theme)
│   ├── layout.tsx                           MODIFY (dark class, Inter font, AlertPanel)
│   ├── page.tsx                             REPLACE (Monitor space)
│   ├── research/
│   │   └── [ticker]/
│   │       └── page.tsx                     CREATE
│   ├── portfolio/
│   │   └── page.tsx                         CREATE
│   ├── macro/
│   │   └── page.tsx                         CREATE
│   └── settings/
│       └── page.tsx                         CREATE
│
├── types/
│   ├── market.ts                            CREATE
│   ├── portfolio.ts                         CREATE
│   ├── financials.ts                        CREATE
│   ├── news.ts                              CREATE
│   ├── ai.ts                                CREATE
│   └── ws.ts                                CREATE
│
├── lib/
│   ├── api.ts                               MODIFY (types, session header, missing endpoints)
│   ├── utils.ts                             MODIFY (add formatPercent, formatDelta)
│   └── queryClient.ts                       CREATE (singleton QueryClient)
│
├── stores/
│   ├── uiStore.ts                           REPLACE (dark default, activeSpace, alertPanel)
│   ├── priceStore.ts                        EXTEND (previousCloses, subscribedTickers)
│   ├── watchlistStore.ts                    CREATE
│   └── alertStore.ts                        CREATE
│
├── hooks/
│   ├── useWebSocket.ts                      FIX (action, derive change, memory leak)
│   ├── queries/
│   │   ├── useCompanyQuery.ts               CREATE
│   │   ├── useChartQuery.ts                 CREATE
│   │   ├── usePortfolioQuery.ts             CREATE
│   │   ├── usePortfolioSummaryQuery.ts      CREATE
│   │   ├── useFinancialsQuery.ts            CREATE
│   │   ├── usePeersQuery.ts                 CREATE
│   │   ├── useNewsQuery.ts                  CREATE
│   │   ├── useMarketsQuery.ts               CREATE
│   │   ├── useMarketMonitorQuery.ts         CREATE
│   │   ├── useMacroQuery.ts                 CREATE
│   │   ├── useWatchlistQuery.ts             CREATE
│   │   ├── useAlertsQuery.ts                CREATE
│   │   ├── useBriefQuery.ts                 CREATE
│   │   └── useSearchQuery.ts                CREATE
│   └── mutations/
│       ├── useWatchlistMutations.ts         CREATE
│       └── useAlertMutations.ts             CREATE
│
├── providers/
│   └── QueryProvider.tsx                    MODIFY (singleton client, devtools)
│
└── components/
    ├── primitives/                          13 components
    │   ├── Badge.tsx                        CREATE
    │   ├── ChangeCell.tsx                   CREATE
    │   ├── CurrencyValue.tsx                CREATE
    │   ├── DataRow.tsx                      CREATE
    │   ├── DensityTable.tsx                 CREATE
    │   ├── MiniChart.tsx                    CREATE
    │   ├── Panel.tsx                        CREATE
    │   ├── PanelHeader.tsx                  CREATE
    │   ├── Pill.tsx                         CREATE
    │   ├── Skeleton.tsx                     REWRITE (dark)
    │   ├── StatusDot.tsx                    CREATE
    │   ├── Ticker.tsx                       CREATE
    │   └── Tooltip.tsx                      CREATE
    │
    ├── compounds/                           19 components
    │   ├── AlertBell.tsx                    CREATE
    │   ├── AlertForm.tsx                    CREATE
    │   ├── AlertList.tsx                    CREATE
    │   ├── BriefPanel.tsx                   CREATE
    │   ├── CandleChart.tsx                  CREATE
    │   ├── ExposureTreemap.tsx              CREATE
    │   ├── FinancialsTable.tsx              CREATE
    │   ├── FundamentalsBlock.tsx            CREATE
    │   ├── HoldingsTable.tsx                CREATE
    │   ├── MarketTable.tsx                  CREATE
    │   ├── NewsStream.tsx                   CREATE
    │   ├── PeerTable.tsx                    CREATE
    │   ├── PortfolioSummaryBar.tsx          CREATE
    │   ├── QualityRadar.tsx                 CREATE
    │   ├── QuoteHeader.tsx                  CREATE
    │   ├── SearchResults.tsx                CREATE
    │   ├── TaxWrapperBar.tsx                CREATE
    │   ├── TimeframeSelector.tsx            CREATE
    │   └── WatchlistTable.tsx               CREATE
    │
    ├── features/                            12 components
    │   ├── alerts/AlertsFeature.tsx         CREATE
    │   ├── brief/BriefFeature.tsx           CREATE
    │   ├── chart/ChartFeature.tsx           CREATE
    │   ├── company/CompanyFeature.tsx        CREATE
    │   ├── financials/FinancialsFeature.tsx  CREATE
    │   ├── macro/MacroFeature.tsx           CREATE
    │   ├── monitor/MarketMonitorFeature.tsx  CREATE
    │   ├── markets/MarketsFeature.tsx        CREATE
    │   ├── news/NewsFeature.tsx             CREATE
    │   ├── peers/PeersFeature.tsx           CREATE
    │   ├── portfolio/PortfolioFeature.tsx    CREATE
    │   └── watchlist/WatchlistFeature.tsx    CREATE
    │
    └── layout/                              6 components
        ├── Sidebar.tsx                      REWRITE (dark, store sync, spaces)
        ├── TopBar.tsx                       REWRITE (dark, StatusDot, AlertBell)
        ├── BottomNav.tsx                    REWRITE (dark, spaces)
        ├── SpaceLayout.tsx                  CREATE
        ├── CommandPalette.tsx               MODIFY (live search, dark)
        └── AlertPanel.tsx                   CREATE
```

**Totals: ~80 files (14 modify/rewrite, ~66 create)**

---

## New Dependencies

| Package | Justification |
|---------|---------------|
| `react-error-boundary` | Declarative error boundaries per feature — prevents one API failure from killing the whole space |
| `@tanstack/react-query-devtools` | Dev-only query inspection (essential during build) |

Everything else uses existing installed packages.

---

## Build Sequence

### Phase 1 — Foundation (unblocks everything)
1. Create all `src/types/` files
2. Create `src/lib/queryClient.ts`
3. Rewrite `src/app/globals.css` (dark-first tokens, `@import "tailwindcss"`)
4. Update `src/app/layout.tsx` (dark class on html, Inter via next/font)
5. Replace `src/stores/uiStore.ts` (dark default, activeSpace)
6. Extend `src/stores/priceStore.ts` (previousCloses)
7. Fix `src/hooks/useWebSocket.ts` (action bug, derive change)
8. Update `src/lib/api.ts` (types, session header, missing endpoints)
9. Update `src/providers/QueryProvider.tsx` (singleton client)

### Phase 2 — Primitive Component Library
All 13 primitives: Panel, PanelHeader, DensityTable, ChangeCell, CurrencyValue, Badge, Pill, Ticker, Skeleton, StatusDot, MiniChart, DataRow, Tooltip

### Phase 3 — Layout Shell
1. Rewrite Sidebar (dark, store sync, space switcher)
2. Rewrite TopBar (dark, StatusDot, AlertBell)
3. Create SpaceLayout (CSS grid per space)
4. Enhance CommandPalette (live search, dark)
5. Rewrite BottomNav (dark, spaces)
6. Create AlertPanel

### Phase 4 — Monitor Space (first working page)
1. Create query hooks: useMarketMonitorQuery, useWatchlistQuery, useNewsQuery, useBriefQuery
2. Create compounds: MarketTable, WatchlistTable, NewsStream, BriefPanel
3. Create features: MarketMonitorFeature, WatchlistFeature, NewsFeature, BriefFeature
4. Replace `app/page.tsx` as Monitor space

### Phase 5 — Research Space
1. Create query hooks: useCompanyQuery, useChartQuery, useFinancialsQuery, usePeersQuery, useSearchQuery
2. Create compounds: QuoteHeader, CandleChart, TimeframeSelector, FundamentalsBlock, FinancialsTable, QualityRadar, PeerTable
3. Create features: CompanyFeature, ChartFeature, FinancialsFeature, PeersFeature
4. Create `app/research/[ticker]/page.tsx`

### Phase 6 — Portfolio Space
1. Create query hooks: usePortfolioQuery, usePortfolioSummaryQuery
2. Create compounds: HoldingsTable, ExposureTreemap, PortfolioSummaryBar, TaxWrapperBar
3. Create feature: PortfolioFeature
4. Create `app/portfolio/page.tsx`

### Phase 7 — Macro Space
1. Create query hook: useMacroQuery
2. Create feature: MacroFeature
3. Create `app/macro/page.tsx`

### Phase 8 — Alerts System
1. Create stores: watchlistStore, alertStore
2. Create query/mutation hooks
3. Create compounds: AlertBell, AlertForm, AlertList
4. Create feature: AlertsFeature
5. Wire AlertPanel

### Phase 9 — Polish
1. Error boundaries per feature
2. Loading.tsx per route segment
3. React Query DevTools (dev only)
4. Audit all `any` types
5. GBX currency edge cases
6. Settings page

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| lightweight-charts v5 React integration | Chart rendering issues, memory leaks on unmount | Build PriceChart.tsx first as standalone test; verify chart.remove() cleanup |
| Chart data format mismatch | Backend time field may be ISO vs epoch | Check /routers/charts.py before assuming format; lightweight-charts needs epoch seconds or YYYY-MM-DD |
| WebSocket in App Router | Client components only; accidental server import crashes | All feature components get 'use client' at top |
| SSE streaming for AI review | CORS may block EventSource cross-origin | Verify main.py CORS middleware allows localhost:3000 |
| Portfolio analytics perf | 20+ concurrent quote fetches = 3-10s latency | staleTime 60s, show DB holdings immediately while analytics resolve |
| Tailwind 4 dark mode config | v4 changed dark mode configuration from v3 | CSS variable approach sidesteps this; verify dark: prefix works |
| Session ID regeneration | Clearing localStorage loses portfolio/watchlist | Accept by design; add "Clear & Reset" in Settings |

---

## Demo Script

A successful first demo:

1. **Open the app.** Monitor space loads: dense table of 20+ instruments with Day%/Week%/Month% columns, colour-coded. Macro strip at top: US 10Y, GBP/USD, Gold. Right panel: 8 news items. Dark theme, dense, professional.

2. **Press Cmd+K.** Command palette opens. Type "SHEL". Live results: "Shell plc - SHEL.L - 2,487p (+0.8%)". Press Enter.

3. **Research space loads** for SHEL.L. Quote header with live price. 1Y OHLC candlestick chart. Key stats (PE 8.2x, Cap GBP142B, Yield 4.1%). AI Brief panel with 4 bullets. Click "Analyst Mode" for deeper analysis.

4. **Click "Portfolio"** in sidebar. Drop zone: drag Brewin Dolphin export. Parser resolves 23/25 holdings. Click "Save". Holdings table appears sorted by weight. Sector treemap shows Financials 31%, Energy 22%. TaxWrapperBar shows ISA/GIA breakdown with remaining allowance.

5. **WS status dot** in TopBar is green. Price ticks update live in Monitor and Research spaces.

---

*Architecture finalised April 2026. Implementation begins Phase 1.*
