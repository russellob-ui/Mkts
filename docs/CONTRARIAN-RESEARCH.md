# MKTS — Contrarian UX Research Report
*Multi-agent council synthesis across 58 financial platforms*
*Compiled: April 2026 | Challenge to RESEARCH.md recommendations*

---

## EXECUTIVE SUMMARY

Six independent research agents analysed 58 platforms across institutional terminals, retail trading apps, UK wealth platforms, portfolio trackers, data visualisation tools, and mobile-first finance apps. The findings converge on several points that **directly contradict** the original RESEARCH.md recommendations.

**The original thesis:** "Calm Premium Terminal" — Linear/Stripe aesthetic, light-mode default, card-based widget grids, left sidebar navigation, Inter font, mobile-first.

**The contrarian consensus:** The evidence from 58 platforms suggests a different direction — one that respects data density, prioritises command-driven interaction, and treats MKTS as a desktop-first power tool rather than a consumer SaaS product.

---

## THE 12 CONTRARIAN PRINCIPLES

These are ranked by strength of evidence across multiple agents.

### 1. DARK MODE SHOULD BE THE DEFAULT
**Evidence strength: VERY HIGH (5/6 agents agree)**

Bloomberg, Webull, Moomoo, Trading 212, Tiger Brokers, Robinhood Legend, and TradingView all default to dark. eToro added dark mode by popular demand. Financial data — especially coloured chart lines, sparklines, and candlesticks — reads better on dark backgrounds. Dark mode reduces eye strain for extended sessions and enables higher information density (bright text on dark requires less padding for readability).

The "light-mode default" recommendation was based on the modern SaaS aesthetic (Linear, Stripe, Notion). But those are low-information-density tools. Financial terminals are high-density by nature. The market is moving toward dark, not away from it.

**Recommendation:** Default to dark mode. Offer light mode as a toggle. Design dark-first.

---

### 2. COMMAND BAR IS THE PRIMARY NAVIGATION, NOT THE SIDEBAR
**Evidence strength: VERY HIGH (5/6 agents agree)**

Bloomberg's `<GO>` bar. Koyfin's command bar. AlphaSense's dual search bars. Capital IQ's ChatIQ. Raycast's entire UI. Robinhood Legend's search. Every power-user platform converges on the same conclusion: **typing is faster than clicking**.

A left sidebar is discovery navigation — useful for new users learning what's available. Russell already knows what MKTS does. A command bar that handles search ("AAPL"), navigation ("go to portfolio"), queries ("show sector breakdown"), and actions ("set alert NVDA > 1000") is strictly superior for a single-user power tool.

**Recommendation:** Make the command palette (`Cmd+K` or `/`) the primary interaction. Keep a minimal sidebar for spatial orientation, but it should be collapsible and secondary.

---

### 3. CARD-BASED WIDGET GRIDS ARE OVERRATED FOR FINANCIAL DATA
**Evidence strength: HIGH (4/6 agents agree)**

Trading 212's bubble-card redesign was **reversed in 10 days** after user revolt — the strongest real-world evidence that cards harm financial UX. Bloomberg, FactSet, Visible Alpha, and Capital IQ all use dense tables and tiled panels, not card grids. Cards add visual overhead (padding, borders, shadows, rounded corners) that reduces scannable density.

The platforms handling the most complex financial data reject cards entirely. Cards work for consumer dashboards (weather, to-do lists) but financial data is inherently tabular — forcing it into cards wastes space and reduces scannability.

**Recommendation:** Use dense tables and tiled panels as the primary layout. Reserve cards for summary/KPI displays only. Never put tabular data inside a card.

---

### 4. DESKTOP-FIRST, MOBILE-USABLE
**Evidence strength: HIGH (4/6 agents agree)**

Robinhood Legend is explicitly desktop-only. Bloomberg Terminal is desktop-only. Saxo maintains two separate products (GO for mobile, PRO for desktop). tastytrade treats desktop as primary. Every serious analytical platform prioritises screen real estate.

The "mobile-first" recommendation assumes MKTS is a consumer app. It's not — it's a personal research terminal. The mobile experience should be a **companion** (quick watchlist glance, alerts, single-stock view) not a responsive version of the desktop.

**Recommendation:** Design for 1440px+ viewport first. Create a genuinely different mobile companion layout, not a responsive collapse of the desktop.

---

### 5. AI SHOULD BE EMBEDDED INTELLIGENCE, NOT A CHAT SIDEBAR
**Evidence strength: HIGH (4/6 agents agree)**

The most effective AI integrations are NOT chat interfaces:
- OpenBB: AI as a command translator (natural language → data queries)
- Composer: AI as a strategy architect (text → executable flowcharts)
- Simply Wall St: AI as narrative generator (data → plain-English summaries)
- Capital IQ ChatIQ: AI as search enhancement (queries → synthesised answers)

A chat sidebar is "a UX admission that your interface failed to surface the right information." The contrarian move: kill the dedicated chat panel. Instead, embed AI as:
1. **Annotations** — automatic plain-English insights on charts and data
2. **Command bar intelligence** — natural language queries that produce views
3. **Proactive alerts** — surface what matters without being asked
4. **Narrative generation** — AI-written briefs that replace static KPI displays

**Recommendation:** No dedicated AI chat page. Integrate AI into the command bar, auto-annotations, and morning brief generation.

---

### 6. DONUT/PIE CHARTS ARE THE WORST PORTFOLIO VISUALISATION
**Evidence strength: MODERATE-HIGH (3/6 agents agree)**

Humans cannot accurately compare arc lengths. Better alternatives exist:
- **Treemaps** (Finviz) — show allocation AND performance simultaneously via size + colour
- **Radar/snowflake charts** (Simply Wall St) — multi-dimensional quality scores
- **Sankey diagrams** (Delta) — show allocation flow/changes over time
- **Contribution analysis** (Sharesight) — decompose returns into capital gains, dividends, FX effects

**Recommendation:** Default to treemap for allocation views. Use radar charts for quality scoring. Never use donut/pie charts.

---

### 7. COMPLEXITY IS A FEATURE, NOT A BUG
**Evidence strength: MODERATE-HIGH (3/6 agents agree)**

IBKR Desktop is the clearest proof: a beautiful modern redesign that professional traders **actively reject** in favour of the cluttered TWS. Bloomberg's deliberately non-standard interface is a moat. Moomoo wins users by refusing to simplify.

The "calm premium" aesthetic risks feeling patronising or toy-like. The aspiration should be "Bloomberg made approachable" — not "Linear with stock prices."

However, this does NOT mean making things ugly. It means:
- Dense but well-organised (clear typographic hierarchy)
- Everything visible but properly grouped (tabbed sections, not hidden)
- Keyboard shortcuts for power users, visible affordances for learning
- Respect the user's intelligence — don't hide complexity, structure it

**Recommendation:** Aim for structured density, not minimalism. Show more data by default, organised through clear visual hierarchy.

---

### 8. SPACES/CONTEXTS BEAT A SINGLE DASHBOARD
**Evidence strength: MODERATE (3/6 agents agree)**

Arc Browser's Spaces, Robinhood Legend's 9 saved layouts, LSEG Workspace's role-based views, and Grafana's variable-driven templates all point to the same insight: users work in multiple modes.

A single dashboard tries to serve monitoring, researching, and reviewing simultaneously. Spaces let you optimise each context:
- **Monitor** space: watchlist, alerts, market movers (dense, real-time)
- **Research** space: deep stock analysis, charts, financials (focused)
- **Portfolio** space: holdings, P&L, allocation, tax (periodic review)
- **Macro** space: economic indicators, central bank calendar (context)

**Recommendation:** Implement 4-5 switchable spaces with distinct layouts, not a single customisable dashboard. Switch via keyboard shortcuts or top bar.

---

### 9. THE REAL UK PLATFORM GAP IS CROSS-WRAPPER INTELLIGENCE, NOT AESTHETICS
**Evidence strength: MODERATE (2/6 agents, but deeply evidenced)**

No UK platform currently tells you: "You have £4,200 of unused ISA allowance. This GIA holding has £800 of unrealised gain within your CGT allowance — transfer it now tax-free."

The killer differentiator for a UK personal terminal isn't rounded corners or Indigo accents. It's:
- ISA/SIPP/GIA allowance tracking with optimisation suggestions
- CGT calculator with Section 104 pooling and bed-and-breakfast rules
- Dividend tax tracking (£1,000 allowance, tiered rates)
- Bed-and-ISA workflow with CGT impact preview
- UK stamp duty (0.5% SDRT) in transaction previews

**Recommendation:** Build tax-wrapper intelligence as a first-class feature, not an afterthought. This is the actual competitive moat.

---

### 10. BUILD FOR OUTPUTS, NOT JUST VIEWING
**Evidence strength: MODERATE (2/6 agents agree)**

YCharts won a UX award for its **report builder**, not its dashboard. Sharesight's primary value is **tax reporting**. Morningstar Direct is for **portfolio construction proposals**. Datadog's notebooks capture **investigative narratives**.

The real workflow: research → analyse → generate deliverable. A terminal that only optimises "view data" misses the most valuable step. MKTS should support:
- Exportable PDF portfolio reports
- Shareable analysis snapshots (URL deep-linking)
- Tax year summary exports
- Investigation notebooks (live charts + annotations)

**Recommendation:** Add a notebook/investigation mode and export capabilities early, not as an afterthought.

---

### 11. SCORING AND GAMIFICATION HELP — BUT ONLY FOR RISK
**Evidence strength: MODERATE (2/6 agents agree)**

Simply Wall St's snowflake and Ziggma's scoring both drive engagement. But Ziggma's risk-first scoring (concentration risk, correlation, drawdown exposure) is more valuable than quality scoring (which can encourage false confidence).

A "portfolio health score" that measures diversification, concentration risk, and tax efficiency gives users an actionable feedback loop.

**Recommendation:** Implement a portfolio-level risk/health score, not stock-picking quality scores.

---

### 12. CALENDAR/TIMELINE NAVIGATION IS UNDERRATED
**Evidence strength: MODERATE (2/6 agents agree)**

Stock Events proves that for income investors, a calendar of upcoming dividends and earnings is more useful than any dashboard. Sharesight proves that tax-year-oriented reports beat real-time dashboards for long-term investors.

Time-based navigation ("what's happening this week/month/tax year") is often superior to asset-based navigation ("show me stocks/bonds/cash").

**Recommendation:** Include a calendar/timeline view as a primary navigation option, not just a widget.

---

## PLATFORMS RESEARCHED (58 total)

### Institutional Terminals (10)
Bloomberg Terminal, Refinitiv/LSEG Workspace, FactSet, Capital IQ Pro, Morningstar Direct, YCharts, AlphaSense/Sentieo, Visible Alpha, IBKR Desktop, Koyfin Pro

### Retail Trading Apps (10)
Robinhood Legend, Webull, Moomoo/Futu, Public.com, eToro, Trading 212, Stake, Tiger Brokers, Saxo Bank, tastytrade

### UK Platforms & Wealth (10)
Hargreaves Lansdown, AJ Bell/Dodl, Freetrade, Interactive Investor, Vanguard UK, Nutmeg, Moneybox, InvestEngine, Quilter, Charles Stanley Direct

### Portfolio Trackers & AI (10)
Simply Wall St, Stock Events, Delta, Sharesight, Portfolio Performance, Ziggma, Finviz, TIKR Terminal, OpenBB Terminal, Composer

### Data Visualisation & Dashboards (10)
Grafana, Datadog, Linear.app, Notion, Retool, Metabase, Vercel Analytics, Arc Browser, Raycast, Obsidian

### Mobile-First & PWA Finance (8)
Revolut, Monzo, Wise, Cash App, Wealthsimple, Coinbase, Yahoo Finance, Seeking Alpha

---

## HOW THIS CHANGES THE DESIGN DIRECTION

| Original Recommendation | Contrarian Revision |
|--------------------------|---------------------|
| Light-mode default | **Dark-mode default**, light toggle |
| Left sidebar primary nav | **Command bar primary**, collapsible sidebar secondary |
| Card-based widget grid (24-col) | **Dense tables + tiled panels**, cards only for KPI summaries |
| Mobile-first | **Desktop-first**, separate mobile companion |
| AI chat page | **Embedded AI** in command bar, annotations, briefs |
| Donut charts for allocation | **Treemaps** for allocation, radar for quality |
| "Calm Premium" aesthetic | **Structured density** — Bloomberg-approachable, not Linear-clean |
| Single customisable dashboard | **Switchable spaces** (Monitor/Research/Portfolio/Macro) |
| Standard SaaS design | **Cross-wrapper tax intelligence** as the killer feature |
| Dashboard-only | **Dashboard + notebook/investigation mode** |
| Pie/donut for portfolio | **Treemap + contribution analysis** |
| Generic design | **Opinionated defaults** with density toggle |

---

## WHAT TO KEEP FROM THE ORIGINAL RESEARCH

Not everything should change. These original recommendations are validated by the contrarian research:

1. **Inter font** — universally appropriate for data-dense financial UIs. Confirmed.
2. **Emerald/Red for positive/negative** — industry standard. Confirmed.
3. **TradingView Lightweight Charts** — open source, performant, battle-tested. Confirmed.
4. **Command palette (Cmd+K)** — originally recommended and now elevated to primary navigation. Confirmed and strengthened.
5. **Tabular numerals (`font-variant-numeric: tabular-nums`)** — essential for number columns. Confirmed.
6. **Recharts for non-price charts** — appropriate for bar charts, area charts, radar charts. Confirmed.
7. **PWA architecture** — validated, especially for URL-based deep linking and cross-device continuity. Confirmed.
8. **Indigo accent colour** — works well in both light and dark mode. Confirmed (but used more sparingly in dark mode).

---

## RECOMMENDED NEXT STEP

Move to architecture planning with these revised design principles. The implementation should be phased:

**Phase 1 — Foundation:** Dark theme, layout system with spaces, command palette, core data components (dense tables, tiled panels)
**Phase 2 — Portfolio Intelligence:** Holdings table, treemap allocation, portfolio health score, tax-wrapper awareness
**Phase 3 — Market Research:** Stock deep-dive space, charts, financials, embedded AI annotations
**Phase 4 — Macro & News:** Economic calendar, macro indicators, news feed with AI briefs
**Phase 5 — Outputs:** Notebook mode, PDF exports, shareable snapshots

---

*Research compiled from 6 independent agents analysing 58 platforms. Each agent was briefed to find contrarian views that challenge the original RESEARCH.md recommendations.*
