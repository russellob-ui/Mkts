# MKTS — UX & Design Research Report
*Comprehensive analysis of 52+ financial apps, dashboards and design systems*
*Compiled: April 2026 | Audience: UK CFO personal market research terminal rebuild*

---

## CONTENTS

1. [Top 10 Design Insights](#1-top-10-design-insights)
2. [Recommended Design Direction for MKTS](#2-recommended-design-direction-for-mkts)
3. [Dashboard Widget List](#3-dashboard-widget-list)
4. [Mobile Patterns](#4-mobile-patterns)
5. [Charting Recommendations](#5-charting-recommendations)
6. [Colour Palettes](#6-colour-palettes)
7. [Site-by-Site Analysis](#7-site-by-site-analysis)
8. [Typography & Spacing System](#8-typography--spacing-system)
9. [Component Patterns Worth Stealing](#9-component-patterns-worth-stealing)
10. [Sources & References](#10-sources--references)

---

## 1. TOP 10 DESIGN INSIGHTS

### Insight 1 — The "Bloomberg for Retail" Template is Crowded, but Koyfin Owns It
Koyfin is widely acknowledged as the highest-satisfaction platform in the Investment Research & Analytics category (rated 9/10 in the 2025 Kitces AdvisorTech Study, ahead of Bloomberg, FactSet, Morningstar). Its key formula: drag-and-drop widget dashboards, left-sidebar navigation, right-sidebar watchlist/news/movers panel, light AND dark mode, and professional-grade data at consumer prices. MKTS should study this layout deeply but push the visual design further — Koyfin's palette is functional but not beautiful.

### Insight 2 — TradingView Owns the Chart Canvas; Don't Try to Out-Compete It
TradingView's charting library (Lightweight Charts, their open-source library) is the industry standard. Their dark theme (`#131722` background, `#2962FF` primary blue, pure `#FFFFFF`) is optimised for reducing visual noise around price data. The important takeaway: MKTS should integrate TradingView's `lightweight-charts` library rather than building chart components from scratch — it is open-source, performant, and battle-tested for financial candlestick/line/area charts.

### Insight 3 — Data Density and Whitespace Are NOT Mutually Exclusive
Stockanalysis.com and TIKR Terminal prove you can pack immense fundamental data (P/E, EV/EBITDA, revenue growth, margins, 20-year history) into a clean interface by relying on: (a) tabbed sections rather than infinite scroll, (b) compact data tables with right-aligned numbers, (c) a clear typographic hierarchy — large heading KPIs at top, progressively smaller data below. The lesson: use whitespace *between* data groups, not within them. Dense rows + comfortable card margins = readable high-density.

### Insight 4 — Card-Based Widget Grids are the Universal Dashboard Pattern
Every best-in-class dashboard — Datadog, Grafana, Koyfin, Yahoo Finance, OpenBB Workspace, IBKR Desktop, and Benzinga Pro — uses a responsive card/widget grid. Widgets should be: drag-and-drop resizable, independently refreshable, closeable/addable from a library, and capable of linking (changing a ticker in one widget updates all linked widgets on the same board). Grafana's 24-column grid and Datadog's responsive snapping grid are the gold standard implementations.

### Insight 5 — Colour Should Be Functional, Not Decorative
The best financial UIs use colour very sparingly: one primary brand accent (blue, teal, or indigo), green/red *only* for positive/negative change (never for branding), neutral grays for 80%+ of the surface, and one highlight colour for CTAs. Robinhood's "Robin Neon" yellow-green avoids the cliché of market green. Stripe's Cornflower Blue (`#635BFF`) and dark navy (`#0A2540`) demonstrate that financial UI can feel modern and premium without defaulting to Bloomberg terminal green-on-black.

### Insight 6 — The Command Palette is the Power-User Superpower
Linear.app normalised the command palette (`Cmd+K`) for SaaS tools, and Raycast took it to the OS level. For a personal investment terminal, a global search/command palette is essential: type a ticker, a command ("show AAPL DCF"), or navigate to any section. Koyfin already has this. MKTS must have it. It transforms the experience from "dashboard" to "terminal."

### Insight 7 — Snowflake/Spider Charts are Powerful for Multidimensional Stock Scoring
Simply Wall St's Snowflake chart — a pentagon that scores Valuation, Growth, Performance, Financial Health, and Dividends — allows instant portfolio scanning. The colour gradient (red → orange → yellow → green) communicates quality at a glance. MKTS should implement a similar "Stock Health Hexagon" or "Quality Pentagon" that synthesises multiple data points into one scannable glyph. This is one of the most distinctive and beloved UI patterns in the sector.

### Insight 8 — Mobile First Means Bottom Nav, Not Hamburger
Every mobile-leading app (Robinhood, Freetrade, Delta, Moomoo) uses a bottom navigation bar for 3–5 primary destinations. Freetrade's 2025 rebrand confirmed the pattern: mobile investing apps should feel closer to Instagram than to a desktop portal. The thumb zone is the entire design constraint. Data tables must horizontally scroll within their card. Charts must respond to pinch-to-zoom. Key KPIs must be the first thing visible without scrolling.

### Insight 9 — The Light Theme is the Modern Choice
Freetrade's 2025 rebrand leaned "more towards black than white" for their identity but kept the UI primarily light to reduce clutter. Stockanalysis.com, AlphaSpread, and Morningstar all default to light mode, matching the modern SaaS aesthetic (Linear, Stripe, Notion). The market is moving away from "Bloomberg dark" as the fintech standard. A high-quality light theme with an optional dark mode is the correct choice for a modern CFO tool that will be used during working hours.

### Insight 10 — UK-Specific Platforms Lag Dramatically on Design
AJ Bell, Hargreaves Lansdown, and Spreadex all offer functional but visually dated interfaces. HL is described as "slightly dated compared to slicker rivals." This is a massive opportunity for MKTS: the UK-focused personal terminal space is wide open for a modern, beautiful, data-dense experience. The design gap between US consumer apps (Robinhood, Public) and UK institutional platforms (HL, AJ Bell) is enormous — MKTS can occupy the premium middle ground.

---

## 2. RECOMMENDED DESIGN DIRECTION FOR MKTS

### Overall Aesthetic

**"Calm Premium Terminal"** — not Bloomberg dark, not Robinhood consumer-casual, but the intersection of:
- Linear.app's density, polish, and keyboard-first philosophy
- Stripe Dashboard's trust-building clarity and typographic precision
- Koyfin's financial data comprehensiveness
- Stockanalysis.com's no-nonsense data tables
- AlphaSpread's clean valuation-focused layout

Think: a private wealth management portal built by a top-tier SaaS design team. Restrained, authoritative, and fast. The aesthetic communicates "this is a serious tool used by serious people" — without feeling like a trading floor terminal or a Bloomberg imitation.

### Colour Direction

**Primary palette: Slate + Indigo Accent**

- Background (light): `#F8FAFC` (near-white slate) with card surfaces at `#FFFFFF`
- Background (dark mode): `#0F1117` with card surfaces at `#1A1D27`
- Sidebar: `#FFFFFF` with a very subtle `1px` border (`#E2E8F0`) — no heavy grey side panel
- Primary accent: `#4F46E5` (Indigo 600) — a nod to Stripe's indigo, signals modernity without being "techy blue"
- Positive/Up: `#10B981` (Emerald 500) — not pure green, warmer and more premium
- Negative/Down: `#EF4444` (Red 500) — clean, not orange-hinted
- Warning/Neutral: `#F59E0B` (Amber 500)
- Text primary: `#0F172A` (Slate 900)
- Text secondary: `#64748B` (Slate 500)
- Text muted: `#94A3B8` (Slate 400)
- Dividers/borders: `#E2E8F0` (Slate 200)

**Do not use:**
- Bloomberg green on black
- Robinhood lime green as a brand colour
- Heavy dark sidebar with bright accent
- Multiple competing accent colours

### Typography

**Primary font: Inter** (free, Google Fonts, purpose-built for UI)
- Specifically designed for dense data interfaces
- Excellent legibility at 11px–14px (critical for data tables)
- Tabular numerals variant for aligned number columns (use `font-variant-numeric: tabular-nums`)
- All major fintech design systems (Stripe, Morningstar, many others) use Inter or a close derivative

**Fallback stack:** `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

**Scale (8px base):**
- Display: 32px / 700 weight (portfolio total value, key hero numbers)
- H1: 24px / 600 — page titles
- H2: 18px / 600 — section headers, card titles
- H3: 15px / 600 — table column headers, sub-sections
- Body: 14px / 400 — standard prose, descriptions
- Data: 13px / 400-500 — data table rows, most financial figures
- Caption: 12px / 400 — labels, units, timestamps
- Micro: 11px / 500 — badges, tags, axis labels on charts

**Number formatting rules:**
- Always use `font-variant-numeric: tabular-nums` for any column of numbers
- Right-align all numerical data in tables
- Positive changes: prefix with `+`, colour `#10B981`
- Negative changes: no prefix (negative sign native), colour `#EF4444`
- Large numbers: `£1.23M`, `£4.56B` (abbreviated, British format)
- GBX → GBP auto-conversion with a subtle `p` indicator

### Layout System

**Grid: 12-column, 8px base unit**

- Max content width: 1440px
- Gutters: 16px (mobile), 24px (tablet), 32px (desktop)
- Dashboard grid: 24 sub-columns (like Grafana) enabling 1/4, 1/3, 1/2, 2/3, full width widgets
- Default widget heights: 1-unit (80px), 2-unit (192px), 3-unit (304px), 4-unit (416px)
- Widget border-radius: `8px`
- Card shadow: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- Card padding: `16px 20px`

**Navigation structure:**
- Left sidebar (240px collapsed to 56px icon rail) — primary navigation
- Top bar (56px) — global search/command palette, user context, alerts bell
- Right sidebar (300px, collapsible) — watchlist, movers, news feed
- Main content area — widget dashboard canvas

**Sidebar navigation items (priority order):**
1. Dashboard (home/overview)
2. Portfolio
3. Watchlist (quick access alternative)
4. Screener
5. Charts
6. Macro
7. News
8. AI Brief / Research
9. Settings

---

## 3. DASHBOARD WIDGET LIST

A world-class personal investment dashboard for a UK CFO. Each widget is classified by size (S/M/L/XL) and priority (1=essential).

### PORTFOLIO OVERVIEW SECTION

| Widget | Size | Priority | Description |
|--------|------|----------|-------------|
| **Portfolio Total Value** | S | 1 | Hero number: total GBP value, 1-day change £/%, YTD change %. Badge for GBP/GBX conversion note |
| **Portfolio P&L Summary** | M | 1 | Realised vs unrealised P&L, cost basis, total return including dividends |
| **Asset Allocation Donut** | M | 1 | UK equities / US equities / Bonds / Cash / Other — interactive, click to drill |
| **Portfolio Performance Chart** | L | 1 | Area chart: portfolio total return vs FTSE 100 vs S&P 500. Selectable periods: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, Max |
| **Holdings Table** | XL | 1 | Sortable columns: ticker, name, quantity, avg cost, current price, market value, unrealised P&L, weight%, day change. Compact rows (32px). Inline sparkline per row |
| **Sector Exposure** | M | 2 | Horizontal bar chart: % by GICS sector |
| **Geographic Exposure** | M | 2 | World map heatmap or treemap: % by country |
| **Dividend Calendar** | M | 2 | Monthly bar chart or calendar view: projected dividend income |
| **Position Quality Hexagon** | M | 2 | Aggregate portfolio quality score across 6 dimensions (like SimplyWallSt Snowflake, applied to portfolio) |
| **Top Movers** | S | 2 | Top 3 gainers and losers in portfolio today |
| **Tax Summary** | S | 3 | CGT allowance used, estimated tax year liability (UK: £3k allowance 2025+) |

### MARKET OVERVIEW SECTION

| Widget | Size | Priority | Description |
|--------|------|----------|-------------|
| **Index Tiles** | M | 1 | FTSE 100, FTSE 250, S&P 500, Nasdaq, DAX, Nikkei — each as a compact tile with sparkline |
| **Sector Heatmap** | L | 1 | Finviz-style colour/size map: FTSE and S&P sectors by day performance |
| **Market Movers** | M | 1 | Top 5 gainers/losers for UK and US markets — today only |
| **Economic Calendar** | M | 1 | Next 7 days: UK/US macro releases (CPI, PMI, GDP, BoE, Fed). Colour-coded impact level |
| **Fear & Greed / VIX** | S | 2 | VIX level + 30-day chart; or a composite sentiment gauge |
| **Yield Curve** | M | 2 | UK Gilt and US Treasury yield curves side by side, overlaid at two dates |
| **Currency Matrix** | S | 2 | GBP/USD, GBP/EUR, GBP/JPY, GBP/CHF — current rates + 1-day change |
| **Commodity Strip** | S | 2 | Gold, Oil (Brent), Silver, Natural Gas — price + day change |
| **Put/Call Ratio** | S | 3 | US options market sentiment indicator |

### SINGLE STOCK / RESEARCH SECTION (activated when ticker is selected)

| Widget | Size | Priority | Description |
|--------|------|----------|-------------|
| **Price Chart** | XL | 1 | Full-featured candlestick/line/area chart. TradingView Lightweight Charts integration. Support/resistance, volume bars, overlay indicators (MA20, MA50, MA200, RSI, MACD) |
| **Key Stats Bar** | M | 1 | P/E, EV/EBITDA, P/B, P/S, Market Cap, 52-week range, Average Volume — single row of badges |
| **Financial Summary** | L | 1 | Revenue, Gross Profit, EBITDA, Net Income — 5-year trailing bars + current year estimate. Toggle between absolute and margin view |
| **Valuation Multiples** | M | 1 | Forward P/E vs 5Y avg vs sector avg. Simple comparison chart |
| **Analyst Ratings** | S | 1 | Buy/Hold/Sell distribution, consensus price target vs current |
| **Stock Quality Pentagon** | S | 2 | RadarChart: Value, Growth, Quality, Momentum, Dividend — scored 0–100 each |
| **News Feed** | M | 1 | Latest headlines filtered to ticker. Source, time-ago, sentiment badge |
| **Insider Transactions** | S | 2 | Last 6 months: buys vs sells from 13F/PDMR filings |
| **Institutional Ownership** | S | 2 | Top holders, % change last quarter |
| **DCF Snapshot** | M | 3 | AlphaSpread-style: base/bull/bear intrinsic value vs current price |

### MACRO SECTION

| Widget | Size | Priority | Description |
|--------|------|----------|-------------|
| **FRED Chart Builder** | XL | 2 | Embedded or custom: plot any FRED series. Multi-series overlay. Recession shading |
| **Macro Indicator Grid** | L | 2 | UK: CPI, Core CPI, GDP growth, Unemployment, BoE Rate. US: same equivalents. Table format with trend arrows |
| **Global PMI Map** | M | 3 | World choropleth: Manufacturing PMI by country |
| **Central Bank Calendar** | S | 2 | Next BoE, Fed, ECB, BoJ meetings + current rates |

### NEWS & ALERTS

| Widget | Size | Priority | Description |
|--------|------|----------|-------------|
| **Global News Feed** | M | 1 | Multi-source: Reuters, FT, Bloomberg, GNews — filterable by topic/ticker |
| **Portfolio News** | M | 1 | News filtered to held tickers only |
| **Price Alerts Manager** | S | 2 | Active alerts list: price above/below thresholds |
| **Earnings Surprises** | S | 2 | Last 10 earnings beats/misses for held stocks |

### AI SECTION

| Widget | Size | Priority | Description |
|--------|------|----------|-------------|
| **AI Brief** | M | 1 | Daily 3-paragraph morning brief: macro context, portfolio movers, key events today |
| **AI Research Chat** | L | 2 | Chat interface: ask questions about any ticker or macro topic. Streaming responses |
| **Sentiment Analyser** | S | 3 | AI-scored news sentiment for portfolio: aggregate and per-holding |

---

## 4. MOBILE PATTERNS

### Navigation Pattern
**Bottom tab bar with 5 destinations:**
1. Home (overview dashboard)
2. Portfolio (holdings table + P&L)
3. Markets (indices + movers + heatmap)
4. Research (search + stock detail)
5. More (alerts, settings, AI)

Do NOT use a hamburger menu as the primary navigation. The bottom tab bar is the universal standard on iOS and Android for financial apps (Robinhood, Freetrade, Delta, Moomoo all confirmed this).

### Mobile-Specific Layout Rules

**Cards stack vertically** — the 24-column desktop grid collapses to a single column on mobile. Each widget becomes a full-width card. Cards should show their most essential data first; secondary tabs are acceptable to reduce scroll depth.

**Holdings table on mobile:**
- Show: Ticker, Name, Current Value, Day Change%
- Horizontal scroll to reveal: Avg Cost, Unrealised P&L, Weight
- Row height: minimum 48px (touch target)
- "Swipe right to reveal actions" — add to watchlist, set alert (learned from Freetrade and Delta)

**Charts on mobile:**
- Default to line chart (cleaner than candlestick on small screens)
- Period selector below chart (not above) — Stockanalysis.com mobile pattern
- Pinch-to-zoom support on chart canvas (Moomoo patented this enhancement)
- Full-screen chart mode on landscape rotation

**Price tiles:**
- Minimum 44×44pt tap target (Apple HIG standard)
- Number font size: minimum 16px on mobile (no 11px micro-labels on key figures)

**Search pattern:**
- Full-screen search overlay on mobile (not a dropdown)
- Recent searches + most-watched tickers as default suggestions
- Ticker search results: symbol, company name, exchange badge, current price + change

**Forms and input:**
- Number inputs should use `inputmode="decimal"` to trigger numeric keyboard
- Quantity/price fields: extra-large (52px height) on mobile

### Progressive Web App (PWA) Considerations
MKTS is already accessible as a PWA (noted in CLAUDE.md: `app.kubera.com` style). Ensure:
- Add-to-home-screen prompt after 3 uses
- Offline mode: show cached portfolio data when API calls fail
- Push notifications for price alerts (Web Push API)
- App-like transitions: no full page reloads, use React Router with slide transitions

### Mobile Colour Adaptations
- Reduce data density: fewer columns, larger touch targets
- Use the same colour palette — no need for a separate mobile colour scheme
- In dark mode: saturate the positive/negative colours slightly (`#34D399` green, `#F87171` red) for better contrast on OLED screens

---

## 5. CHARTING RECOMMENDATIONS

### Primary Charting Library: TradingView Lightweight Charts

**Recommendation: Use `lightweight-charts` (open source, from TradingView)**

Reasons:
- Open source, free, MIT-licensed
- Built specifically for financial time-series data
- Extremely performant (WebGL-accelerated canvas rendering)
- Supports: candlestick, OHLC, line, area, bar, histogram (volume)
- Used by hundreds of fintech products
- ~40KB gzipped — significantly lighter than Highcharts or ApexCharts
- Touch/gesture support built in
- Crosshair tooltip, range selector, time axis syncing between charts

**For macro/fundamentals charts:** Use Recharts or Visx (both D3-based React wrappers) — better for bar charts, line charts with multiple series, area charts showing earnings trends, etc.

**For the portfolio performance chart:** A smooth area chart (not candlestick) is appropriate. Use Recharts `AreaChart` with a gradient fill: the accent colour (`#4F46E5`) with 20% opacity fill, matching the Koyfin/Robinhood portfolio visual language.

### Chart Design System

**Background:** Match card background — `#FFFFFF` in light mode, `#1A1D27` in dark mode.

**Grid lines:** Very subtle — `#F1F5F9` in light mode (Slate 100), `#252836` in dark mode. Horizontal only; no vertical grid lines on most charts.

**Axis labels:** 11px Inter, Slate 400 colour (`#94A3B8`). Right-aligned Y-axis for price (financial convention).

**Candlesticks:**
- Up candle body: `#10B981` (Emerald 500)
- Down candle body: `#EF4444` (Red 500)
- Wick: same colour as body, 60% opacity

**Volume bars:** Same colour scheme, 40% opacity, shown below main chart.

**Crosshair:** 1px dashed line, `#64748B`, with a floating tooltip card showing OHLCV data.

**Overlays:**
- MA20: `#F59E0B` (Amber) — distinct from both up/down colours
- MA50: `#6366F1` (Indigo 500)
- MA200: `#8B5CF6` (Violet 500)
- RSI panel: `#2DD4BF` (Teal 400) line with 70/30 reference lines in `#E2E8F0`

**Recession shading (macro charts):** Very light `#FEF3C7` (Amber 50) fill regions — visible but not distracting.

**Benchmark overlay:** When comparing portfolio to FTSE 100, show the benchmark as a thin dashed line in `#94A3B8` (muted) vs the portfolio as a solid `#4F46E5` line.

### Chart Types by Use Case

| Use Case | Recommended Chart Type | Library |
|----------|----------------------|---------|
| Stock price history (daily+) | Candlestick with volume | lightweight-charts |
| Stock price history (intraday) | Line/area (smoother) | lightweight-charts |
| Portfolio performance | Area with gradient fill | Recharts |
| Revenue/earnings history | Grouped bar chart | Recharts |
| Margins over time | Stacked area | Recharts |
| Valuation multiples comparison | Horizontal bar (peers) | Recharts |
| Sector allocation | Donut/pie | Recharts |
| Yield curve | Multi-line with date selector | Recharts |
| Macro indicator (FRED-style) | Line + recession shading | Recharts / custom D3 |
| Market heatmap | Treemap with colour scale | Visx or custom D3 |
| Portfolio quality spider | Radar/spider chart | Recharts RadarChart |
| Asset allocation (world) | Choropleth map | react-simple-maps + D3 |

### Chart Interaction Patterns

1. **Period selector:** Pill buttons below chart: 1D · 1W · 1M · 3M · 6M · YTD · 1Y · 3Y · Max. Selected state: filled background in accent colour. NOT a dropdown.

2. **Crosshair tooltip:** Dark card (`#1E293B` in both modes), white text, shows all relevant data. Positioned to avoid chart edges.

3. **Zoom/pan:** Click+drag to zoom into a date range. Double-click to reset. Mobile: pinch-to-zoom.

4. **Comparison mode:** "Add comparison" button overlays a second series as a dotted line. Percentage-normalised (both start at 0%).

5. **Full-screen mode:** Icon in top-right of chart card. Opens the chart in a modal overlay — useful on desktop.

6. **Export:** Download PNG or CSV from a `...` overflow menu on the chart card.

---

## 6. COLOUR PALETTES

### MKTS Recommended Palette (Primary)

| Role | Name | Light Mode | Dark Mode |
|------|------|-----------|-----------|
| Page background | Slate 50 | `#F8FAFC` | `#0F1117` |
| Card/surface | White | `#FFFFFF` | `#1A1D27` |
| Card border | Slate 200 | `#E2E8F0` | `#252836` |
| Sidebar background | White | `#FFFFFF` | `#13151F` |
| Text primary | Slate 900 | `#0F172A` | `#F1F5F9` |
| Text secondary | Slate 500 | `#64748B` | `#94A3B8` |
| Text muted | Slate 400 | `#94A3B8` | `#475569` |
| Primary accent | Indigo 600 | `#4F46E5` | `#6366F1` |
| Primary accent hover | Indigo 700 | `#4338CA` | `#818CF8` |
| Positive/Up | Emerald 500 | `#10B981` | `#34D399` |
| Positive bg | Emerald 50 | `#ECFDF5` | `#064E3B` (20%) |
| Negative/Down | Red 500 | `#EF4444` | `#F87171` |
| Negative bg | Red 50 | `#FEF2F2` | `#7F1D1D` (20%) |
| Warning/Neutral | Amber 500 | `#F59E0B` | `#FCD34D` |
| Warning bg | Amber 50 | `#FFFBEB` | `#78350F` (20%) |
| Focus ring | Indigo 300 | `#A5B4FC` | `#A5B4FC` |
| Selection highlight | Indigo 50 | `#EEF2FF` | `#1E1B4B` |

### Industry Reference Palettes (for inspiration)

**TradingView Dark Theme:**
- Background: `#131722`
- Secondary bg: `#1E222D`
- Border: `#2A2E39`
- Primary blue: `#2962FF`
- Up/green: `#26A69A` (teal-green, not pure green)
- Down/red: `#EF5350`
- Text: `#D1D4DC`
- Muted text: `#787B86`

**Stripe Dashboard:**
- Deep navy: `#0A2540`
- Near-white bg: `#F6F9FC`
- Cornflower blue (accent): `#635BFF`
- Link blue: `#1A56DB`
- Success green: `#1EA672`
- Danger red: `#DF1B41`

**Freetrade 2025 Rebrand:**
- Primary dark: Near-black with reduced white space
- Accent: Retained variation of their original pink/magenta
- Philosophy: "Infinite sky" — aspirational, sunrise/sunset gradient accents on marketing
- App UI: Clean, minimal, high contrast

**Robinhood:**
- Brand: Black + white + "Robin Neon" yellow-green (`#00C805` legacy, updated to a more yellow-tinted bright green)
- Background: White (light) / True black `#000000` (dark — OLED-optimised)
- Accent: Neon green for positive, muted orange-red for negative
- Notable: Deliberately avoids traditional financial blue

**Morningstar Design System:**
- Primary red: Pantone 185 equivalent — `#D82526` (Morningstar Red)
- Background: `#F5F5F5` light gray
- Text: `#1E1E1E`
- Dark blue: `#003561`
- Teal: `#007F86`
- Note: Morningstar uses red as a BRAND colour (not as "down"), which requires careful system design

**Koyfin (inferred from screenshots/reviews):**
- Light mode default background: `#FFFFFF` / `#F4F6F9`
- Dark "Midnight Blue" mode: `#1A1E2E` approx
- Primary blue accent: Approximately `#1F67DE`
- Sidebar: Slightly darker than page bg, no heavy dark sidebars
- Data positive: Standard `#22C55E` green
- Data negative: Standard `#EF4444` red

**Linear.app:**
- Background (light): `#FFFFFF`
- Sidebar (light): `#F7F7F7`
- Primary accent: Varies by theme — default purple `#5E6AD2`
- Border: `#E5E5E5`
- Text: `#141414`
- Warm gray system built in LCH colour space for perceptual uniformity

### Colour Recommendations for Financial Data Classification

| Data Type | Colour | Hex | Usage |
|-----------|--------|-----|-------|
| Positive change | Emerald | `#10B981` | Price up, beats estimate, positive P&L |
| Negative change | Red | `#EF4444` | Price down, misses estimate, loss |
| Neutral/Flat | Slate | `#94A3B8` | 0% change, N/A values |
| Estimate/Forecast | Indigo dashed | `#6366F1` | Chart overlay — projected data |
| Strong Buy | Emerald 600 | `#059669` | Analyst ratings |
| Buy | Emerald 400 | `#34D399` | Analyst ratings |
| Hold | Amber | `#F59E0B` | Analyst ratings |
| Sell | Red 400 | `#F87171` | Analyst ratings |
| Strong Sell | Red 600 | `#DC2626` | Analyst ratings |
| Sector: Technology | Indigo | `#6366F1` | Heatmaps, allocation charts |
| Sector: Financials | Blue | `#3B82F6` | |
| Sector: Healthcare | Emerald | `#10B981` | |
| Sector: Energy | Amber | `#F59E0B` | |
| Sector: Consumer | Rose | `#F43F5E` | |
| Sector: Industrials | Orange | `#F97316` | |
| Sector: Materials | Teal | `#14B8A6` | |
| Sector: Utilities | Violet | `#8B5CF6` | |

---

## 7. SITE-BY-SITE ANALYSIS

### PROFESSIONAL / SEMI-PRO

---

#### 1. Koyfin — koyfin.com
**Overall rating for MKTS inspiration: 9/10**

- **Design aesthetic:** Clean semi-light default. Professional without being intimidating. Now only two themes: Light (default) and Dark (Midnight Blue). Warm, approachable data density — feels like a grown-up version of a financial news site rather than a terminal. The design eliminates cumbersome elements.
- **Colour palette:** Light mode: white/near-white surfaces, blue primary accent (~`#1F67DE`). Dark mode: deep navy ~`#1A1E2E`. Standard green/red for data changes.
- **Data density:** High but structured. Left sidebar for navigation (collapsible), right sidebar for watchlist/movers/news (collapsible), main area for customisable widget dashboard.
- **Dashboard layout:** Drag-and-drop widget system. Widgets can be arranged freely. "Linking" — change a ticker in one widget and linked widgets update.
- **Mobile experience:** Auto theme mode syncs to system preference. Mobile app available. Functional but secondary to desktop.
- **Best UI patterns:** Widget linking system; right sidebar as "information rail"; keyboard navigation; the overall concept of "Bloomberg for retail" executed cleanly.
- **Charting:** Professional-grade. Fundamentals charting (revenue, EPS, margins over time), technical charting (price with indicators), macro charting (multi-series FRED-style). Separate panels for each.
- **Key differentiator:** Ranked #1 for satisfaction (9/10) among financial advisors in 2025 Kitces study. Most comprehensive alternative to Bloomberg for individual use.
- **Steal:** Widget dashboard system; right-rail side panel; the overall information architecture.

---

#### 2. TradingView — tradingview.com
**Overall rating for MKTS inspiration: 8/10 (for charts specifically: 10/10)**

- **Design aesthetic:** Mostly neutral, chart-first. The chart canvas IS the product. Dark mode is dominant among active users (the `#131722` Mirage background is iconic). Light mode feels like an afterthought.
- **Colour palette:** Primary: Dodger Blue `#2962FF`, Mirage dark `#131722`, White `#FFFFFF`. Up/green: teal-green `#26A69A`. Down/red: `#EF5350`.
- **Data density:** Very high on charts (100+ indicators, 12+ drawing tools). Dashboard/home page is moderate density. Social feed adds noise.
- **Dashboard layout:** Widget system available. "Screener" and "Supercharts" are separate modes. The main experience is the full-page chart editor.
- **Mobile experience:** Good mobile charting. Moomoo has actually expanded on their mobile charting model with a US patent for drawing tools.
- **Best UI patterns:** Period selector design (pill tabs); chart crosshair tooltip; indicator panel management (add from a searchable library); the chart toolbar paradigm.
- **Charting:** Industry gold standard. Candlestick, OHLC, Henkouashi, Renko, Range, etc. Replay mode. Drawing tools including Fibonacci, Gann, patterns.
- **Key differentiator:** The `lightweight-charts` open-source library (derived from TradingView's chart engine) should be MKTS's primary chart component.
- **Steal:** Chart toolbar design; period selector pill buttons; crosshair tooltip card; indicator library modal.

---

#### 3. Stockanalysis.com — stockanalysis.com
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** Ultra-clean, almost brutally simple. White background, minimal chrome, content-first. Fast-loading. Feels like a well-designed Wikipedia for stocks.
- **Colour palette:** Near-white background, black/dark gray text, standard green/red, blue links. No heavy branding.
- **Data density:** Very high for fundamentals. 20 years of financials in compact tables. All key ratios visible without scrolling on desktop.
- **Dashboard layout:** Tab-based navigation for each stock: Summary | Financials | Valuation | Forecast | Earnings | Dividends | IPO | News. Each tab loads a focused data view.
- **Mobile experience:** Excellent mobile adaptation. Time period selector moves below chart on mobile. Full-screen search overlay on mobile. Very responsive.
- **Best UI patterns:** Tab navigation for stock detail pages; compact financial tables with sticky headers; the "summary" tab concept (key stats at a glance before drilling into detail tabs).
- **Charting:** Clean area/line charts for fundamental data (revenue over time). Integrates a basic price chart. Not a charting powerhouse but functional.
- **Key differentiator:** Speed. The site is among the fastest financial data sites. Modern data provider (Fiscal.AI) updates within minutes of earnings. Changelog shows active development.
- **Steal:** Tab-based stock detail navigation; compact fundamental data tables; mobile-first search UX.

---

#### 4. Finviz — finviz.com
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** Utilitarian, information-dense, not beautiful. The design hasn't changed significantly in 10+ years. But the functionality — especially the heatmap — is best-in-class.
- **Colour palette:** Dominated by the green/red heatmap colours. White/light gray background. Table-heavy. No modern design sensibility.
- **Data density:** Extremely high. The screener can filter on 60+ fundamental and technical parameters simultaneously. The map view is visually overwhelming in a good way.
- **Dashboard layout:** Screener is a horizontal filter bar above a dense sortable table. Map view is a full-page treemap. Minimal navigation chrome.
- **Mobile experience:** Poor on mobile. Designed for desktop; small screens show horizontal scroll.
- **Best UI patterns:** The heatmap/treemap for market overview is the defining pattern. Sector groupings. Colour scale green→red with intensity representing magnitude. Tile size representing market cap. This is the pattern MKTS should replicate for its Market Heatmap widget.
- **Charting:** Basic but functional. Company overview chart is straightforward.
- **Key differentiator:** Market heatmap is THE reference implementation. Every competing heatmap is compared to Finviz.
- **Steal:** Heatmap tile design; screener filter chip pattern; the concept of a "Groups" view for sector/industry rotation analysis.

---

#### 5. Simply Wall St — simplywall.st
**Overall rating for MKTS inspiration: 8/10 (for visual pattern innovation)**

- **Design aesthetic:** Modern, friendly, visual-first. Uses data storytelling rather than data dumping. Cards with illustrated analysis. Feels accessible rather than intimidating.
- **Colour palette:** Clean white backgrounds. The Snowflake uses a gradient red→orange→yellow→green (traffic light). Teal/blue accent. Sankey diagram in soft blues/greens.
- **Data density:** Moderate — deliberately simplified for retail investors. But uses visual compression effectively: one Snowflake replaces a full-page of numbers.
- **Dashboard layout:** Portfolio view shows all holdings with their Snowflake miniature. Clicking a stock expands to a detailed analysis page. Clean grid of stock cards.
- **Mobile experience:** Good. Available on Android and iOS. The visual-first approach translates well to mobile.
- **Best UI patterns:**
  - **Snowflake/Spider chart for multidimensional stock quality** — essential pattern for MKTS
  - **Sankey diagram for revenue-to-profit flow** — powerful for financial analysis
  - **Colour-gradient health scoring** — red (bad) → green (good) with intermediate states
  - **Card-per-stock in portfolio view** — beats a raw table for quick quality scanning
- **Charting:** Distinctive and specialised. Not for price charting — for analysis visualisation.
- **Key differentiator:** Made stock analysis genuinely visual and accessible. Proves you can convey complex financial health in a single icon/chart.
- **Steal:** Snowflake/pentagon quality radar chart; traffic-light gradient scoring; portfolio card grid with visual quality indicator.

---

#### 6. Barchart — barchart.com
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** Dense, functional, dated. Lots of information but the layout feels inherited from early 2010s web design. Ad-heavy on free tier.
- **Colour palette:** Blue/white primary scheme. Standard green/red. Nothing distinctive.
- **Data density:** Very high — options chains, futures curves, technical summary grades, all presented in compact tables.
- **Dashboard layout:** Traditional news/data portal layout. Top nav with many dropdowns. Very wide tables.
- **Mobile experience:** Mediocre — not designed mobile-first.
- **Best UI patterns:** Options chain layout (strike price grid with calls on left, puts on right, current price highlighted in the middle) is a reference implementation. The "Technical Summary" scoring (Strong Buy / Buy / Neutral / Sell / Strong Sell with sub-category breakdown) is a useful pattern.
- **Charting:** Functional but not beautiful. Standard candlestick charts.
- **Steal:** Options chain strike-price grid layout (useful if MKTS adds derivatives).

---

#### 7. Macrotrends — macrotrends.net
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** Utilitarian. No design ambition. Value is purely in the data depth — 100-year charts for major indices, 40+ years of fundamental data per stock.
- **Colour palette:** Nothing distinctive. Standard web colors.
- **Data density:** Moderate — one chart per page, with data table below.
- **Best UI patterns:** The long-term historical chart with recession shading is a reference implementation. The ability to view 100 years of Dow Jones or 40 years of a company's P/E ratio is unmatched. The concept of "recession bands" as chart overlays is worth implementing in MKTS macro charts.
- **Steal:** Recession period shading on macro charts; historical range toggle; the concept of very-long-term financial charts as a distinct view.

---

#### 8. Unusual Whales — unusualwhales.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Dark, modern, slightly edgy. Alternative data focus (unusual options flow, dark pool prints). Popular with a younger, more active trading audience.
- **Colour palette:** Dark theme. Colourful data visualisations — purple, cyan, and magenta accents on dark backgrounds. More visually expressive than traditional fintech.
- **Data density:** High for options/flow data. Novel visualisations for order flow heatmaps.
- **Best UI patterns:** Options flow tape visualisation (real-time large order feed with colour-coded premium/type). Dark pool prints feed. Congressional trading tracker (unique content).
- **Charting:** Options-focused charts — put/call ratio, open interest by strike, flow over time.
- **Steal:** Real-time order/alert feed with colour-coded type badges; the concept of "unusual" data surfacing (outlier detection as a UI concept).

---

#### 9. Fintel — fintel.io
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** Functional, somewhat dated. Not flashy. Depth of institutional data compensates for design limitations.
- **Design approach:** Clean navigation; customisable watchlist tabs (News, Sentiment, Institutions, Insiders, Filings, Fund Tracker); personal notebook feature.
- **Best UI patterns:** The concept of per-ticker tabbed context (each tab showing a different data "lens" on the same ticker) is excellent. The watchlist with configurable sub-tabs is worth replicating.
- **Steal:** Per-ticker tab layout with configurable data lenses; personal notes/notebook attached to a stock.

---

#### 10. OpenBB — openbb.co
**Overall rating for MKTS inspiration: 8/10 (for architecture concepts)**

- **Design aesthetic:** Modern, clean. The Workspace product (now the main product) is a polished React-based dashboard builder. Looks like a cross between Datadog and a Bloomberg terminal rebuild.
- **Colour palette:** Dark mode dominant. Clean, professional.
- **Data density:** Very high — designed for quants and analysts. Any data source can be integrated.
- **Dashboard layout:** **Widget library system** — a blank canvas onto which you drag widgets from a searchable library. Parameter linking (changing a ticker in one widget updates all linked widgets). This is more powerful than Koyfin's system.
- **Best UI patterns:**
  - **Blank canvas + widget library** — superior to fixed-layout dashboards
  - **Widget parameter syncing** — one global ticker context that all widgets respect
  - **AI Copilot integrated into the research workflow** — not bolted on
- **Charting:** Integrates any charting approach — TradingView, Plotly, custom.
- **Steal:** Widget parameter linking/syncing architecture; widget library drawer concept; AI copilot integration into the main canvas.

---

### CONSUMER TRADING

---

#### 11. Robinhood — robinhood.com
**Overall rating for MKTS inspiration: 7/10 (for mobile patterns)**

- **Design aesthetic:** Ultra-clean consumer fintech. Became the reference implementation for "commission-free app" design. White/black/neon palette. The redesigned identity (2022+) uses pure black, white, and "Robin Neon" (a bright yellow-green). Less warm than before but more premium.
- **Colour palette:** Black `#000000`, White `#FFFFFF`, Robin Neon (bright lime-yellow-green). The neon is used very sparingly — only for brand moments. Financial data uses separate green/red system.
- **Data density:** Low by professional standards. By design — Robinhood's core user is a new investor.
- **Dashboard layout:** Mobile-first. Bottom tab nav: Home / Stocks / Crypto / Options / More. Portfolio value is the hero number on the home screen with a line chart below.
- **Mobile experience:** Gold standard for consumer mobile. Simple, clear, and fun without being childish.
- **Best UI patterns:** Portfolio line chart on home screen (smooth, colourful, extends edge-to-edge); the "collection" / thematic investing feature; the options chain redesign (more visual than traditional grid); depth chart for Level 2 data.
- **Steal:** Portfolio chart as the home screen hero; bottom tab navigation pattern; the "extend to edges" chart aesthetic.

---

#### 12. Freetrade — freetrade.io
**Overall rating for MKTS inspiration: 8/10 (for UK-focused design)**

- **Design aesthetic:** Underwent a comprehensive 2025 rebrand. Concept: "the infinite sky" — aspirational, sunrise/sunset-inspired gradients. More black than white in brand, but clean light UI in the app. Mobile-first, Instagram-like (their own description).
- **Colour palette:** Post-rebrand: Deep black primary, retained pink/magenta accent, high whitespace. Aspirational and optimistic.
- **Data density:** Low-moderate — designed for UK retail investors who are not professional traders.
- **Mobile experience:** Excellent. Designed mobile-first from scratch. Bottom navigation. Clean stock detail pages. Fraction share investing with tactile UI.
- **Best UI patterns:** Clean onboarding flows; ISA/SIPP account type switching; the UK-specific framing (GBP, UK tax wrappers, LSE stocks prominently featured). 
- **Steal:** UK market focus; ISA/SIPP account structure in UI; mobile-first stock discovery.

---

#### 13. eToro — etoro.com
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** Social-first, friendly, gamified. Not suited for a professional CFO terminal.
- **Colour palette:** eToro Green `#6AAE22` as primary brand. Clean white backgrounds.
- **Best UI patterns:** "User Insights" profile cards (followers, performance, copy trader stats). Social feed with investment ideas. The "Popular Investor" programme creates a social status layer.
- **Steal:** Social feed pattern if MKTS ever adds idea-sharing; user performance card design.

---

#### 14. Webull — webull.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Data-dense, professional-adjacent. More sophisticated than Robinhood but less polished than Koyfin. Dark mode popular among users.
- **Data density:** High. Shows Level 2, earnings calendar, short interest, institutional ownership, all within a single stock view. "Institutional-grade data in a consumer wrapper."
- **Mobile experience:** Strong mobile experience with a focus on data density that exceeds most consumer apps. Patented a mobile charting method for horizontal scroll with drawing tools.
- **Best UI patterns:** Horizontal data layout toggle (portrait = simple, landscape = data-dense); colour-coded data groups for cross-window data linking; the "News & Daily" AI summary button.
- **Charting:** 56 indicators, 12 drawing tools, 50+ technical indicators. Strong mobile charting.
- **Steal:** Portrait/landscape adaptive layout; colour-coded window grouping for data linking.

---

#### 15. Moomoo — moomoo.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Modern, mobile-first. Clean stock detail pages. Good use of colour for data states.
- **Best UI patterns:** Extended mobile charting with finger-drawing tools (US patent). Cross-device chart sync (draw on phone, appears on desktop). Mobile-specific data density features.
- **Steal:** Cross-device chart annotation sync; the concept of patented mobile-specific charting interactions.

---

#### 16. Hello Stake — hellostake.com
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** Clean, brand new design system launched alongside their interface redesign. Clean card-based layout. Uses colour strategically for CTAs and important information, not decoration.
- **Best UI patterns:** "Discover more and navigate the markets swiftly" is their design goal. Clean navigation hierarchy. Colour and contrast used to direct attention.
- **Steal:** The concept of "colour as information, not decoration" — every colour use serves a functional purpose.

---

#### 17. Public.com — public.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Social-forward, community-driven. Glass texture for transparency metaphor. Bold expressive type as a design element. Feels like a cross between Robinhood and Twitter.
- **Best UI patterns:** Thematic investing collections (instead of traditional sector navigation); personalised feed; glass/transparency aesthetic for trust signalling.
- **Steal:** Thematic collections/watchlists as an alternative to raw sector navigation.

---

#### 18. Interactive Brokers (IBKR Desktop) — interactivebrokers.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Rebuilt from scratch with a new UI framework. Much more modern than TWS (the legacy platform). "Simplified navigation" was the stated goal of IBKR Desktop.
- **Data density:** Very high — access to stocks, options, futures, forex, on 160 markets, with Level 2, advanced charts, screeners, options tools.
- **Dashboard layout:** Widget-based dashboard. Customisable panels. Multi-monitor support. The dashboard comprises widgets for news, portfolio data, and IBKR updates.
- **Best UI patterns:** Multi-monitor layout support; the concept of flexible panels (not just a single dashboard canvas); professional-grade options tools.
- **Steal:** Multi-panel layout concept; the breadth of the widget library.

---

### PORTFOLIO TRACKERS

---

#### 19. Sharesight — sharesight.com
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** Clean, professional, data-focused. Not flashy. UK/Australia-focused with excellent tax reporting.
- **Colour palette:** Standard blue/white with accessible contrast. Supports dark mode, colour-blind friendly.
- **Best UI patterns:** Total return calculation methodology (capital gains + dividends + currency); multi-portfolio management; tax report generation (CGT reports, dividend statements).
- **Steal:** Total return chart (capital gains + dividends as stacked components); the CGT report as a distinct dashboard section (highly relevant for a UK CFO).

---

#### 20. Delta by eToro — delta.app
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** "Most aesthetically pleasing" crypto/multi-asset tracker. Sleek, dark-by-default but with a good light mode. The dark/monochrome display mode for reduced eye strain is a thoughtful touch.
- **Colour palette:** Clean. Dark or light theme. Monochrome mode option. Bright accent colours for performance indicators.
- **Data density:** Very high for a mobile-first app. All portfolio data condensed to one main page.
- **Mobile experience:** Excellent. Instant insights, real-time charts, personalised alerts. Available on iOS, Android, Windows, Mac.
- **Best UI patterns:** "All condensed into one main page" philosophy — intelligent information architecture avoids the need for excessive navigation. Cross-asset tracking (stocks, crypto, ETFs, commodities) in a unified view.
- **Steal:** Single-page portfolio overview with intelligent condensation; the monochrome accessibility mode.

---

#### 21. Kubera — kubera.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Spreadsheet-like for data entry, but drives "cool graphs and trackers" for visualisation. Clean and modern.
- **Best UI patterns:** Net worth as a distinct concept separate from investment portfolio (includes real estate, pensions, crypto, cash); clean net worth timeline chart.
- **Steal:** Net worth total (including illiquid assets) as a potential top-level metric; beneficiary/estate planning integration.

---

#### 22. Ziggma — ziggma.com
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** Clean, analytics-focused. More data-dense than consumer apps. Dashboard feels professional.
- **Best UI patterns:**
  - **Stock Scorecard** — scoring stocks on 4 dimensions (valuation, growth, profitability, financial health) vs industry peers
  - **Portfolio Simulator** — simulate the impact of a trade on portfolio metrics BEFORE executing (risk, diversification, yield change)
  - **Slider-based screener** — range sliders instead of dropdown filters for intuitive screening
  - **Portfolio Beta Risk Factor** — unusual metric displayed prominently
- **Charting:** Standard charting for portfolio performance.
- **Steal:** Portfolio simulator / trade impact preview; slider-based screener; multi-factor stock scorecard vs peers.

---

#### 23. Morningstar — morningstar.com
**Overall rating for MKTS inspiration: 7/10 (design system specifically)**

- **Design aesthetic:** Traditional, authoritative, data-rich. The Morningstar Design System (MDS) is publicly documented — one of the most comprehensive financial design systems available for reference.
- **Colour palette:** Morningstar Red `#D82526` (Paul Rand original from 1991, Pantone 185 equivalent) is their brand colour. Supporting: deep blue `#003561`, teal `#007F86`, neutral grays. The red-as-brand-colour (not as negative indicator) requires careful adaptation.
- **Best UI patterns:** The star rating system (1–5 stars for funds); the "moat" concept (economic moat rating as a single letter badge); the Style Box (3×3 grid for value/blend/growth × small/mid/large).
- **Charting:** Excellent fund/ETF performance charts. Growth of £10,000 chart. Peer comparison charts.
- **Steal:** The "Style Box" concept for rapid fund characterisation; growth-of-fixed-amount performance charts; the moat/quality single-letter badge system.

---

#### 24. Portfolio Visualizer — portfoliovisualizer.com
**Overall rating for MKTS inspiration: 7/10 (for analytical patterns)**

- **Design aesthetic:** Clean and professional, not visually ambitious. Value is analytical depth.
- **Best UI patterns:** Backtest workflow: enter allocations → set date range → run → see performance, risk metrics, drawdowns, rolling returns. The result presentation is exemplary: key metrics summary at top, charts below, data tables at bottom. Monte Carlo simulation with fan plot (probability cone).
- **Steal:** Backtest/simulation result layout pattern; probability cone chart for projections; efficient frontier chart for portfolio optimisation.

---

### MARKET DATA

---

#### 25. Yahoo Finance — finance.yahoo.com
**Overall rating for MKTS inspiration: 6/10**

- **2023 Redesign (still current):** Clean, reduced ads by 40%, better hierarchy. Key improvements: customisable dock/right rail, improved quote pages with 25+ chart types and 100+ indicators, enhanced portfolio view (connects 401K, IRA, savings accounts). Sector pages improved.
- **Best UI patterns:** The customisable dock concept (persistent right-rail widget strip for watchlists, market data). "Sectors" hub with ETF discovery. The 360-degree portfolio view connecting multiple account types.
- **Steal:** The persistent market dock (right rail watchlist strip); sector hub with aggregate statistics.

---

#### 26. MarketWatch — marketwatch.com
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** News-heavy layout. More editorial than analytical. Dense above-the-fold for those who know what they're looking for.
- **Best UI patterns:** The "Snapshot" page format (news + key metrics in one compact view). The earnings calendar widget.
- **Steal:** Earnings calendar/announcements widget design.

---

#### 27. Seeking Alpha — seekingalpha.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** News/analysis hybrid. Premium tier offers quantitative stock grades (A/B/C/D/F by factor) alongside analyst articles. Recent redesign feedback noted "too much whitespace" and slower performance — a useful warning about over-designing.
- **Best UI patterns:** Factor-based letter grades (Valuation: B+, Growth: A-, Profitability: B) displayed as coloured badges are an excellent way to surface multi-factor analysis. The "Quant Score" concept.
- **Steal:** Letter-grade factor badges; the concept of a unified "quant score" + "author score" + "analyst score" showing different signal types.

---

#### 28. Investing.com
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** Comprehensive but cluttered. Ad-heavy. The data depth is impressive for a free product.
- **Best UI patterns:** Global economic calendar is best-in-class for breadth (covers 150+ countries, all economic releases, consensus vs actual vs previous). The currency correlations matrix is useful.
- **Steal:** Economic calendar design and breadth; currency correlation matrix.

---

#### 29. CNBC Markets — cnbc.com/markets
**Overall rating for MKTS inspiration: 5/10**

- **Best UI patterns:** The market data strips at page top (indices as compact horizontal bar). Pre-market/after-market session indicators on price displays.
- **Steal:** Pre/after-market session indicator for quotes.

---

### MACRO DATA

---

#### 30. FRED — fred.stlouisfed.org
**Overall rating for MKTS inspiration: 8/10 (for macro data patterns)**

- **Design aesthetic:** Academic/government clean. Very functional. The chart builder interface is genuinely excellent for what it does.
- **Best UI patterns:** Multi-series chart builder (add any FRED series, customise units/frequency/transformation, overlay on same axis or dual axis); recession period shading (NBER recessions shown as grey bars — a universal standard); data frequency transformation (monthly → quarterly, levels → % change); annotation on charts. The FRED API is the data source for MKTS macro section.
- **Steal:** Recession period shading; multi-series data overlay with unit transformation; data source attribution label on charts.

---

#### 31. Trading Economics — tradingeconomics.com
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** Dense, comprehensive, slightly dated visually. The data breadth (20M+ indicators from 196 countries) is unmatched.
- **Best UI patterns:** Global macro grid — country-by-country comparison tables with colour coding. The "Countries" heat map. The individual country dashboard (GDP, CPI, rate, unemployment all visible on one page).
- **Steal:** Country macro dashboard pattern (one page per country with 4–6 key indicators and their charts); global comparison table with colour encoding.

---

#### 32. MacroMicro — macromicro.me
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** Modern, clean, well-designed for a data-heavy product. Visual-first with intuitive charts. Overlays market data with economic indicators in insightful ways.
- **Best UI patterns:** The ability to overlay "unrelated" data series and reveal correlations (e.g., truck sales leading S&P 500 peaks). The chart builder with auto-updating data. The "Macro Report" concept — curated macro analysis with charts embedded.
- **Charting:** Dynamic, automatically updated charts. Correlation-finding as a feature.
- **Steal:** Macro data × market data overlay concept; the curated macro chart report format; the "leading indicator" framing for macro data.

---

#### 33. Visual Capitalist — visualcapitalist.com
**Overall rating for MKTS inspiration: 7/10 (for data storytelling concepts)**

- **Design aesthetic:** Data journalism, infographic-first. Supersized fonts, bold type, polished layout. Not a dashboard — a publication.
- **Best UI patterns:** Using supersized numbers as design elements. Strong editorial hierarchy: one key insight per graphic. Data annotations directly on charts (not in a legend). The "chart as the story" rather than "chart supporting the story."
- **Steal:** Direct data annotation on charts (label data points rather than relying on a separate legend); supersized KPI numbers as hero elements.

---

### DESIGN INSPIRATION (NON-FINANCE)

---

#### 34. Linear — linear.app
**Overall rating for MKTS inspiration: 9/10**

- **Design aesthetic:** The benchmark for "calm, dense, polished SaaS." Every detail considered. High information density without feeling cluttered. Warm gray colour system built in LCH colour space.
- **Colour palette:** Warm gray primary — shifted from blue-tinted to more neutral/warm gray. High contrast, timeless. Purple/indigo accent. LCH-based colour ramps for perceptual uniformity.
- **Data density:** Very high — issue lists, project views, cycle tracking — all in a compact, scannable format.
- **Best UI patterns:**
  - **Keyboard shortcut discovery:** hover over any element for 2s → tooltip showing keyboard shortcut. Genius UX for power users.
  - **Sidebar density toggle:** expand/collapse without losing context
  - **Progress indicators:** inline, minimal, colour-based
  - **The overall "calm authority" aesthetic** — this is exactly what MKTS should aim for
- **Steal:** Keyboard shortcut hover-discovery; warm-gray LCH colour system; the overall aesthetic direction; sidebar collapse pattern.

---

#### 35. Datadog — datadoghq.com
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** Professional monitoring dashboard. Dense but structured. Dark and light modes. The dashboard builder is more flexible than most financial tools.
- **Dashboard layout:** Fully responsive grid (scales to any screen size). Drag-and-drop. High density mode on large monitors. Widgets snap to grid. Intelligent positioning: auto-align multiple widgets to form a row.
- **Best UI patterns:**
  - **High density mode** toggle for large screens — automatically increases widget density
  - **Widget library** — searchable panel of all available widget types
  - **Grid snapping with auto-alignment** — superior to free-form drag
  - **Row grouping of widgets** — logical grouping within the grid
- **Steal:** High-density mode toggle; widget library drawer; auto-align row formation; responsive grid with snap.

---

#### 36. Grafana — grafana.com
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** The reference implementation for technical dashboards. Dark by default, clean panels, orange accent. Version 12 introduces dynamic dashboards, tabs, and canvas-style layouts.
- **Dashboard layout:** 24-column grid. Row grouping. Tab views. Variable panel templates. Multiple layout modes: grid, auto-grid (responsive), canvas. Nested grouping.
- **Best UI patterns:**
  - **Dashboard variables/parameters** — global filters (date range, metric, server) that update all panels simultaneously. MKTS equivalent: global ticker selector + date range.
  - **Panel library** — save a configured panel and reuse it across dashboards
  - **Row collapsing** — collapse a row to hide its panels, keeping dashboard manageable
  - **Annotation overlays** — mark specific time events (earnings, rate decisions) on time-series charts
- **Steal:** Dashboard variable system (equivalent to OpenBB's parameter linking); panel library/reuse; annotation overlays on time-series charts; row collapse pattern.

---

#### 37. Stripe Dashboard — stripe.com/dashboard
**Overall rating for MKTS inspiration: 9/10**

- **Design aesthetic:** The gold standard for financial SaaS UI. Clean, trustworthy, precise. Accessible colour system (redesigned for WCAG AA compliance). Indigo accent. Navy primary. Near-white surfaces.
- **Colour palette:** Deep navy `#0A2540`, near-white `#F6F9FC`, Cornflower Blue/indigo `#635BFF`, success green `#1EA672`, danger red `#DF1B41`. Each colour chosen for accessibility and contrast.
- **Data density:** High for a consumer-facing financial product. Revenue charts, transaction tables, conversion funnels — all information-dense but calm.
- **Best UI patterns:**
  - **Accessible colour system** — every colour combination passes WCAG AA contrast ratio (important for MKTS, used during working hours)
  - **Table design** — Stripe's tables are a reference: right-aligned numbers, monospace amounts, hover highlight, clear action column
  - **Status badge design** — pill badges with colour encoding and label (Succeeded / Failed / Pending)
  - **Empty state design** — informative, illustrated empty states with clear CTAs
- **Steal:** Accessible colour system approach; table design; status badge system; the overall "indigo on near-white" aesthetic direction.

---

#### 38. Raycast — raycast.com
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** Speed-first, keyboard-centric. The command palette IS the interface. Clean, minimal chrome. Focused on reducing friction to zero for power users.
- **Best UI patterns:**
  - **Command palette (`Cmd+K`)** — instant access to any function, navigation, or data lookup
  - **Intelligent autocomplete** — recent items, context-aware suggestions
  - **Action system** — from a search result, trigger contextual actions (without navigating away)
  - **Extension model** — the palette is extensible via plugins
- **Steal:** The command palette as the primary power-user interface for MKTS; keyboard-first interaction model; the concept of "results then actions" in a unified flow.

---

### UK/EU SPECIFIC

---

#### 39. AJ Bell — ajbell.co.uk
**Overall rating for MKTS inspiration: 4/10 (what to avoid)**

- **Design aesthetic:** Clean and professional, but "slightly dated compared to slicker rivals." Standard UK financial platform aesthetic — corporate blue, white backgrounds, conventional navigation.
- **Key learning:** The dual approach (full Youinvest platform for experienced investors + simplified Dodl app for beginners) validates MKTS's single-user power-user focus — no need to simplify.
- **Steal:** Nothing specific — represents the incumbent UK design standard to surpass.

---

#### 40. Hargreaves Lansdown — hl.co.uk
**Overall rating for MKTS inspiration: 4/10 (what to avoid)**

- **Design aesthetic:** Mature, well-developed, trusted. Rated highly for reliability and breadth but noted as "slightly dated." The "HL Invest" new app (launched 2025) is a cleaner modern version.
- **Best UI patterns:** The watchlist system is comprehensive — can watch funds, shares, ETFs all together. Research pages include sentiment analysis, key ratios, financials, charts. The fund universe with HL's own analysis is unique value.
- **Key learning:** HL's breadth of features (ISA, SIPP, GIA, Junior ISA, savings accounts) in one platform shows the value of account consolidation.
- **Steal:** Account type switcher (ISA/SIPP/GIA) as a top-level concept; fund analysis integration alongside share analysis.

---

#### 41. IG UK — ig.com/uk
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** Clean modern dashboard for CFD/spread betting. Multiple workspace support. Centrally-focused charts with watchlists and trade tickets on sides.
- **Best UI patterns:** Multiple workspace concept (separate workspaces for different trading activities); the "IG Live" embedded news feed; X feed integration; one-click dealing toggle.
- **Steal:** Multi-workspace concept (MKTS could have "UK Portfolio" workspace, "US Watchlist" workspace, "Macro" workspace).

---

#### 42. Stockopedia — stockopedia.com
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** Data-dense, UK-focused, sophisticated. Highly regarded for UK stock research.
- **Best UI patterns:**
  - **StockRanks™** — composite score (Value + Quality + Momentum) displayed as a single number 0–100 with a visual indicator. This is Stockopedia's most distinctive feature.
  - **Traffic light system** — individual factors shown as coloured indicators (green/amber/red)
  - **Factor-based screens** — pre-built screens (High Flyers, Contrarians, Super Stocks) based on historical factor performance
  - **Responsive adaptive design** — works equally well on desktop, tablet, and mobile
- **Steal:** StockRank composite score concept (MKTS equivalent could be a "CFO Score" or "Quality Score" combining key fundamental metrics); traffic-light per-metric scoring; pre-built factor screens.

---

### ADDITIONAL

---

#### 43. AlphaSpread — alphaspread.com
**Overall rating for MKTS inspiration: 8/10**

- **Design aesthetic:** Very well designed in every aspect — "conceptually and graphically." Clean, visual, valuation-focused. The DCF and intrinsic value tools are the main product.
- **Best UI patterns:**
  - **Intrinsic value vs market price** displayed as a simple visual: current price plotted against a base/bull/bear DCF range
  - **Margin of safety** expressed as a colour-coded percentage (green = undervalued, red = overvalued)
  - **Scenario analysis** — adjust DCF inputs (growth rate, WACC, margin) and see intrinsic value update in real time
  - **Dashboard goal tracking** — set target prices and net worth goals
- **Steal:** Intrinsic value gauge (current price vs DCF range); real-time DCF sensitivity tool; margin of safety colour badge.

---

#### 44. TIKR — tikr.com
**Overall rating for MKTS inspiration: 7/10**

- **Design aesthetic:** "More user-friendly and intuitive than Bloomberg or Reuters." Terminal-style but approachable. Designed by former Wall Street analysts — data depth is the priority.
- **Best UI patterns:** S&P Global CapitalIQ-quality data in a retail-accessible interface. 20 years of financial history per company. 10,000+ superinvestor portfolio tracking. Comparable company analysis (comps) interface.
- **Steal:** Comparable company table (5–10 peers side-by-side with key metrics); superinvestor portfolio tracking as a feature; the 20-year financial history depth.

---

#### 45. Benzinga Pro — pro.benzinga.com
**Overall rating for MKTS inspiration: 6/10**

- **Design aesthetic:** News terminal. Customisable with newsfeed, scanners, calendars, watchlists. Functional; not beautiful.
- **Best UI patterns:** 
  - **Real-time news squawk** — audio alerts for breaking news (15+ min ahead of TV)
  - **Colour-coded news sources** — quickly distinguish exclusive Benzinga Wire from general news
  - **Date/time jump** — click to any historical date to review news flow
  - **Earnings calendar with surprise history** — includes past beat/miss record
- **Steal:** Colour-coded news source badges; historical news date-jump feature; the squawk/audio alert concept (as an optional power-user feature).

---

#### 46. WhalewIsdom — whalewisdom.com
**Overall rating for MKTS inspiration: 5/10**

- **Design aesthetic:** Functional, data-focused. Interface is not flashy but data is unique.
- **Best UI patterns:** Combined holdings report aggregating 4,200+ institutional managers; WhaleIndex heatmap for trending stocks among top managers; Excel add-in integration.
- **Steal:** The concept of aggregated "smart money" positions as a heatmap or ranked list widget; 13F filing date countdown.

---

---

## 8. TYPOGRAPHY & SPACING SYSTEM

### Type Scale

```
Display  32px / 700  — Hero KPIs only (portfolio total value)
H1       24px / 600  — Page titles
H2       18px / 600  — Section headers, card titles
H3       15px / 600  — Table column headers
Body     14px / 400  — Standard text, descriptions
Data     13px / 400  — Data table rows, financial figures
Label    12px / 500  — Badges, tags, axis labels
Micro    11px / 500  — Chart axis ticks, footnotes
```

### Number Formatting Rules

```
Always: font-variant-numeric: tabular-nums;  /* aligned decimal points in columns */
Always: text-align: right;                   /* right-align all numbers in tables */

Positive change:  "+2.34%"  colour: #10B981
Negative change:  "−2.34%"  colour: #EF4444  (use minus sign, not hyphen)
Zero change:      "0.00%"   colour: #94A3B8

Market cap:       "£1.23B"  or "£456.7M"  or "£12.3K"
Price (GBX):      "1,234p"  with auto-convert badge  "= £12.34"
Price (GBP):      "£12.34"
Yield:            "3.45%"
Volume:           "4.2M" shares
P/E ratio:        "18.4×"  (with multiplication sign, not "x")
Large round nos:  "£1.2M", "£4.5B", "£1.2T"
```

### Spacing System (8px base)

```
4px   — xs: tight gaps within components (icon+label)
8px   — sm: gap between list items, input padding
12px  — md: compact card padding (dense mode)
16px  — md+: default card padding, section gap
20px  — lg: card padding with breathing room
24px  — xl: major section separation
32px  — 2xl: page-level separation
48px  — 3xl: page header clearance
```

### Border Radius

```
2px  — badges, chips (tight)
4px  — buttons, inputs
6px  — small cards
8px  — standard cards, modals (most used)
12px — larger cards, popovers
16px — floating panels
9999px — pill shapes (period selectors)
```

---

## 9. COMPONENT PATTERNS WORTH STEALING

### 1. Global Command Palette
- Trigger: `Cmd+K` (Mac) / `Ctrl+K` (Windows) — as used by Linear, Raycast, and Koyfin
- Search: tickers by symbol or company name, navigate to any section, execute commands ("add AAPL to watchlist", "set alert at £150")
- Default state: recent searches + most-watched tickers
- Implementation: `cmdk` library for React is the standard

### 2. Linked Widget Parameter System
- Inspired by: OpenBB Workspace, Grafana variables, Koyfin's linking
- A global "active ticker" context that all widgets can subscribe to
- When ticker changes in one widget (chart, stats, news), all linked widgets update
- Visual indicator: widgets in the same "group" share a coloured dot/badge

### 3. Per-Ticker Tab Navigation
- Inspired by: Stockanalysis.com, Fintel, Barchart
- Tabs: Summary | Financials | Valuation | Earnings | Dividends | Analysts | News | Insider
- Tab content loads lazily — only fetch data when tab is selected
- Sticky tab bar on scroll

### 4. Quality Radar / Pentagon Chart
- Inspired by: Simply Wall St Snowflake, Stockopedia StockRanks, Seeking Alpha factor grades
- 5–6 axes: Value, Quality, Growth, Momentum, Dividend, Financial Health
- Each scored 0–100 vs sector/market average
- Colour fills from red (low) to green (high)
- Use `Recharts RadarChart` component
- Show as both a small glyphs in lists AND as a detailed expanded view on stock detail page

### 5. Period Selector Pill Buttons
- Inspired by: TradingView, Stockanalysis.com, Robinhood
- Single row of pill-shaped toggle buttons: 1D · 5D · 1M · 3M · 6M · YTD · 1Y · 3Y · Max
- Selected: filled with accent colour
- Unselected: transparent with subtle border
- No dropdowns for period selection — always visible as pills

### 6. Status Badge System
- Inspired by: Stripe, Seeking Alpha
- Pill-shaped badges with colour-coded status:
  - `A+/A/A−` — factor grades (emerald shades)
  - `B+/B/B−` — moderate factor grades (blue shades)
  - `C/D/F` — weak factor grades (amber/red shades)
  - `Buy / Hold / Sell` — analyst ratings
  - `Beat / Miss / In-Line` — earnings status
  - `ISA / SIPP / GIA` — account type indicators

### 7. Inline Sparklines in Tables
- Inspired by: Koyfin holdings table, Delta portfolio view
- Each row in the holdings table has a tiny 7-day or 30-day sparkline in a "Trend" column
- 60px wide, 24px tall, no axes, just the line
- Use `recharts` LineChart in a tiny wrapper or a custom SVG path generator for performance
- Colour matches the price direction: green sparkline if above N-day ago, red if below

### 8. Collapsible Sidebar with Icon Rail
- Inspired by: Linear, Koyfin, Datadog, VS Code
- Expanded (240px): icon + text label + optional badge/count
- Collapsed (56px): icon only, tooltip on hover showing label
- Transition: smooth 200ms ease-out
- Keyboard shortcut: `[` or `Cmd+\` to toggle
- The collapsed state still shows notification badges

### 9. Right Rail Information Panel
- Inspired by: Koyfin, Yahoo Finance dock
- Persistent right panel (~300px, collapsible)
- Sections: Watchlist tiles | Market Movers | Latest News | Alerts
- Can be collapsed to free up canvas space
- On mobile: becomes a bottom sheet accessed via tab bar

### 10. Contextual Hover Tooltips for Shortcuts
- Inspired by: Linear's keyboard shortcut discovery
- Hover over any interactive element for 1.5 seconds → small tooltip shows keyboard shortcut
- Helps power users discover shortcuts without disrupting the visual design
- Stored in a central keyboard shortcuts map (also accessible from `?` or `Cmd+/`)

### 11. Recession Period Shading
- Inspired by: FRED, MacroTrends
- On all macro time-series charts, overlay NBER recession periods as semi-transparent `#F1F5F9` bands
- Width corresponds to recession start/end dates
- A small label on hover: "Recession (Dec 2007 – Jun 2009)"
- NBER dates are static data — hardcode in the charting config

### 12. Earnings Beat/Miss Timeline
- Inspired by: Stockanalysis, Benzinga Pro
- On the price chart: mark earnings dates with a small vertical tick at the top
- Tick colour: emerald = beat, red = miss, gray = in-line
- On hover: show EPS actual vs estimate, revenue actual vs estimate
- This turns a price chart into a fundamentals narrative

---

## 10. SOURCES & REFERENCES

- [Koyfin Features & Dashboards](https://www.koyfin.com/features/custom-dashboards/)
- [Koyfin Review 2025/2026 — Bullish Bears](https://bullishbears.com/koyfin-review/)
- [Koyfin vs TradingView — TraderHQ](https://traderhq.com/koyfin-vs-tradingview/)
- [TradingView Brand Colours — Mobbin](https://mobbin.com/colors/brand/tradingview)
- [TradingView Colour Schemes Guide — Pineify](https://pineify.app/resources/blog/tradingview-color-schemes-the-complete-guide-to-themes-palettes-and-readability)
- [Robinhood New Visual Identity](https://robinhood.com/us/en/newsroom/a-new-visual-identity/)
- [Robinhood UI Design — Google Design](https://design.google/library/robinhood-investing-material)
- [Freetrade Rebrand 2025](https://freetrade.io/blog/rebrand-2025)
- [Simply Wall St Snowflake Guide](https://support.simplywall.st/hc/en-us/articles/360001740916-How-does-the-Snowflake-work)
- [Finviz Heatmap Guide](https://finviz.blog/finviz-heat-maps-a-visual-guide-to-market-trends/)
- [Stockanalysis Changelog](https://stockanalysis.com/changelog/)
- [Stockopedia Platform Features](https://www.stockopedia.com/features/)
- [AlphaSpread Dashboard](https://www.alphaspread.com/dashboard)
- [TIKR Terminal Review — TraderHQ](https://traderhq.com/tikr-terminal-review/)
- [OpenBB Workspace Introduction](https://openbb.co/blog/introducing-the-new-openbb-terminal/)
- [Grafana Dynamic Dashboards v12](https://grafana.com/blog/dynamic-dashboards-grafana-12/)
- [Datadog Dashboards Product Page](https://www.datadoghq.com/product/platform/dashboards/)
- [Stripe Accessible Colour Systems](https://stripe.com/blog/accessible-color-systems)
- [Stripe Brand Colours — Mobbin](https://mobbin.com/colors/brand/stripe)
- [Linear UI Redesign Blog](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Design Philosophy](https://telablog.com/the-elegant-design-of-linear-app/)
- [Morningstar Design System](https://designsystem.morningstar.com/)
- [Morningstar Colour Palette](https://design.morningstar.com/foundations/color)
- [Inter Font](https://rsms.me/inter/)
- [Geist Font — Vercel](https://github.com/vercel/geist-font)
- [Fintech Dashboard Design Practices 2026 — Eleken](https://www.eleken.co/blog-posts/modern-fintech-design-guide)
- [Best Financial Dashboard Colour Palettes — Phoenix Strategy](https://www.phoenixstrategy.group/blog/best-color-palettes-for-financial-dashboards)
- [Fintech UX Design Best Practices — WildNetEdge](https://www.wildnetedge.com/blogs/fintech-ux-design-best-practices-for-financial-dashboards)
- [Finance Colour Palettes with Hex Codes — Media.io](https://www.media.io/color-palette/finance-color-palette.html)
- [Top React Chart Libraries 2025 — LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [Top 5 React Stock Chart Libraries — Syncfusion](https://www.syncfusion.com/blogs/post/top-5-react-stock-charts-in-2026)
- [Mobile Dashboard Design Patterns — Toptal](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [Bottom Navigation Bar Guide 2025 — AppMySite](https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/)
- [Delta by eToro Investment Tracker Review — Matchmybroker](https://www.matchmybroker.com/tools/delta-investment-tracker-review)
- [Ziggma Review 2026 — Wall Street Zen](https://www.wallstreetzen.com/blog/ziggma-review/)
- [Yahoo Finance New Design Announcement](https://www.businesswire.com/news/home/20231107696257/en/Yahoo-Finance-Debuts-New-Design-and-Features-to-Empower-Everyday-Investors)
- [Bloomberg Terminal Alternatives 2026 — BlueGamma](https://www.bluegamma.io/post/bloomberg-terminal-alternatives)
- [Sharesight Portfolio Tracker App Guide](https://www.sharesight.com/blog/sharesight-app-guide/)
- [Moomoo Charting Features](https://www.moomoo.com/us/feature/charts)
- [Webull Charts & Tools](https://www.webull.com/charts-tools)
- [IBKR Desktop Launch](https://thirdhemisphere.agency/interactive-brokers-unveils-next-generation-trading-platform-ibkr-desktop/)
- [eToro Colour Codes — BrandPalettes](https://brandpalettes.com/etoro-colors/)
- [Seeking Alpha UI Redesign — Maxim Nekhoda](https://www.maximnekhoda.com/seeking-alpha-ui)
- [Hargreaves Lansdown Review 2025 — Invest Platforms](https://investplatforms.co.uk/platform/hargreaves-lansdown/)
- [AJ Bell Review — UK StockBrokers](https://uk.stockbrokers.com/review/aj-bell)
- [Benzinga Pro Review 2026 — Great Work Life](https://www.greatworklife.com/benzinga-review/)
- [WhaleWisdom Review 2025 — Bullish Bears](https://bullishbears.com/whalewisdom-review/)
- [MacroMicro Platform — Product Hunt](https://www.producthunt.com/products/macromicro)
- [Voronoi by Visual Capitalist](https://www.voronoiapp.com)
- [Dashboard Design Principles — UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [Best Dashboard Examples 2026 — Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)

---

*End of MKTS UX & Design Research Report*
*Next step: translate these findings into a Figma design system or Tailwind design tokens for MKTS v6 frontend.*
