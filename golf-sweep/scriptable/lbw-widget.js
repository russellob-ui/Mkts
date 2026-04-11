// London Banter & Woody — Live Scores Widget for Scriptable
// =========================================================
//
// INSTALL:
//   1. Install "Scriptable" from the App Store (free).
//   2. Open Scriptable → tap +  →  paste this entire file  →  save as "LB&W".
//   3. Long-press an empty space on your iPhone home screen → tap the + in
//      the top-left → search "Scriptable" → pick the widget size you want
//      (Medium or Large work best) → tap Add Widget.
//   4. Long-press the newly-added widget → Edit Widget → set:
//        Script         = LB&W
//        When Interacting = Open URL   (leave blank — widget uses its own)
//        Parameter       = (empty)
//   5. Done. iOS will refresh it a few times an hour.
//
// Widget size guide:
//   small  → top 3 picks only (no room for 8 legibly)
//   medium → ALL 8 picks, no thru column
//   large  → ALL 8 picks + thru column + comfortable type
//
// In-app preview defaults to Large so you can see all 8 when testing.
// Tap the widget to jump straight to the live leaderboard in Safari.

const API_URL = "https://mkts-production-8e53.up.railway.app/api/widget";
const SITE_URL = "https://mkts-production-8e53.up.railway.app/";

// --- Colours ------------------------------------------------------------
const BG             = new Color("#0a0a0a");
const AUGUSTA_GREEN  = new Color("#10b981");
const CREAM          = new Color("#f5f1e8");
const MUTED          = new Color("#6b7280");
const DIM            = new Color("#4b5563");

function scoreColor(s) {
  if (s == null) return MUTED;
  if (s <= -4) return new Color("#dc2626"); // deep red (very hot)
  if (s < 0)   return new Color("#ef4444"); // red     (under par)
  if (s === 0) return new Color("#9ca3af"); // grey    (even)
  if (s <= 2)  return CREAM;                // cream   (slightly over)
  return DIM;                               // dim     (blown up)
}

function fmtScore(s) {
  if (s == null) return "—";
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : String(s);
}

function fmtThru(t) {
  if (!t) return "";
  // If it looks like a tee time ("1:44pm"), keep it; else show as-is
  return t;
}

function fmtRelative(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// --- Fetch --------------------------------------------------------------
async function fetchData() {
  try {
    const req = new Request(API_URL);
    req.timeoutInterval = 8;
    req.headers = { "Cache-Control": "no-cache" };
    return await req.loadJSON();
  } catch (err) {
    console.error(`fetch failed: ${err}`);
    return null;
  }
}

// --- Widget construction -------------------------------------------------
function buildWidget(data) {
  const widget = new ListWidget();
  widget.backgroundColor = BG;
  widget.setPadding(12, 12, 12, 12);
  widget.url = SITE_URL;

  // Error state
  if (!data || !data.tournament) {
    const title = widget.addText("LB&W");
    title.font = Font.boldSystemFont(16);
    title.textColor = AUGUSTA_GREEN;
    widget.addSpacer(6);
    const msg = widget.addText(
      data ? "No live tournament" : "Offline — check Wi-Fi"
    );
    msg.font = Font.systemFont(11);
    msg.textColor = MUTED;
    return widget;
  }

  // --- Header --------------------------------------------------------
  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const brand = header.addText("LB&W");
  brand.font = Font.boldSystemFont(14);
  brand.textColor = AUGUSTA_GREEN;

  header.addSpacer();

  const tournament = header.addText(data.tournament);
  tournament.font = Font.mediumSystemFont(10);
  tournament.textColor = MUTED;
  tournament.lineLimit = 1;

  widget.addSpacer(8);

  // --- Rows ----------------------------------------------------------
  //
  // Layout policy:
  //   small  → top 3 (no way to fit 8 legibly in ~150x150 px)
  //   medium → ALL 8 (tight, no thru column, size-down type)
  //   large  → ALL 8 (comfortable, thru column visible)
  const family = config.widgetFamily || "large";
  const isSmall = family === "small";
  const isMedium = family === "medium";

  const rowLimit = isSmall ? 3 : 8;
  const showThru = family === "large";

  // Type size + row spacing — tightened for medium so 8 rows fit
  const nameSize = isSmall ? 11 : isMedium ? 10 : 12;
  const posSize  = isSmall ? 10 : isMedium ? 9  : 11;
  const totSize  = isSmall ? 12 : isMedium ? 11 : 13;
  const rowGap   = isSmall ? 3  : isMedium ? 2  : 4;
  const stripH   = isSmall ? 16 : isMedium ? 14 : 18;

  const rows = (data.entries || []).slice(0, rowLimit);

  for (const e of rows) {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.spacing = isMedium ? 5 : 6;

    // Coloured player strip
    if (e.color) {
      const strip = row.addStack();
      strip.backgroundColor = new Color(e.color);
      strip.size = new Size(3, stripH);
      strip.cornerRadius = 1;
    }

    // Position (monospaced, width aligned to T## / ##)
    const pos = row.addText((e.pos || "-").padEnd(3, " "));
    pos.font = Font.semiboldMonospacedSystemFont(posSize);
    pos.textColor = MUTED;

    // Player name
    const nameText = `${e.avatar ? e.avatar + " " : ""}${e.player}`;
    const name = row.addText(nameText);
    name.font = Font.mediumSystemFont(nameSize);
    name.textColor = CREAM;
    name.lineLimit = 1;
    name.minimumScaleFactor = 0.75;

    row.addSpacer();

    // Total score
    const tot = row.addText(fmtScore(e.tot));
    tot.font = Font.boldMonospacedSystemFont(totSize);
    tot.textColor = scoreColor(e.tot);

    // Thru (large only — medium saves space by dropping it)
    if (showThru) {
      const thru = row.addText(` ${fmtThru(e.thru)}`);
      thru.font = Font.regularMonospacedSystemFont(9);
      thru.textColor = DIM;
      thru.lineLimit = 1;
    }

    widget.addSpacer(rowGap);
  }

  widget.addSpacer();

  // --- Footer --------------------------------------------------------
  const footer = widget.addStack();
  footer.layoutHorizontally();

  const updated = footer.addText(`↻ ${fmtRelative(data.lastPolled)}`);
  updated.font = Font.systemFont(8);
  updated.textColor = DIM;

  footer.addSpacer();

  const tap = footer.addText("tap for live →");
  tap.font = Font.systemFont(8);
  tap.textColor = DIM;

  return widget;
}

// --- Main ---------------------------------------------------------------
const data = await fetchData();
const widget = buildWidget(data);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Running inside Scriptable app (preview mode).
  // Default to Large so you see all 8 picks when testing — override
  // by setting config.widgetFamily before running.
  const fam = config.widgetFamily || "large";
  if (fam === "small") widget.presentSmall();
  else if (fam === "medium") widget.presentMedium();
  else widget.presentLarge();
}

Script.complete();
