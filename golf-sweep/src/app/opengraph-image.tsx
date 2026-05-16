import { ImageResponse } from "next/og";

export const alt = "London Banter & Woody — Major Sweep 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const THEMES: Record<
  string,
  { bg: string; bg2: string; accent: string; text: string; label: string; emoji: string }
> = {
  masters: {
    bg: "#0a3d1f",
    bg2: "#062e15",
    accent: "#ffd700",
    text: "#f5f1e8",
    label: "Masters",
    emoji: "⛳",
  },
  pga: {
    bg: "#0f172a",
    bg2: "#1e293b",
    accent: "#ffd400",
    text: "#ffffff",
    label: "PGA",
    emoji: "🏆",
  },
  "us-open": {
    bg: "#001d4a",
    bg2: "#002868",
    accent: "#ffffff",
    text: "#ffffff",
    label: "US Open",
    emoji: "🇺🇸",
  },
  open: {
    bg: "#1a1a1a",
    bg2: "#2a2a2a",
    accent: "#c9a96e",
    text: "#f5f1e8",
    label: "The Open",
    emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  },
};

function detectTheme(): (typeof THEMES)[string] {
  const month = new Date().getMonth() + 1;
  if (month <= 4) return THEMES.masters;
  if (month <= 5) return THEMES.pga;
  if (month <= 6) return THEMES["us-open"];
  if (month <= 7) return THEMES.open;
  return THEMES.pga;
}

export default function OGImage() {
  const theme = detectTheme();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: theme.bg,
          fontFamily: "serif",
          overflow: "hidden",
        }}
      >
        {/* Left: accent stripe */}
        <div
          style={{
            width: 8,
            height: "100%",
            background: `linear-gradient(180deg, ${theme.accent} 0%, transparent 100%)`,
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 80px",
          }}
        >
          {/* LB&W small logo */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.accent,
              letterSpacing: "0.2em",
              textTransform: "uppercase" as const,
              marginBottom: 16,
              display: "flex",
            }}
          >
            LB&W
          </div>

          {/* Tournament name — big and bold */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: theme.text,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginBottom: 12,
              display: "flex",
            }}
          >
            {theme.label}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 24,
              color: theme.text,
              opacity: 0.5,
              marginBottom: 40,
              display: "flex",
            }}
          >
            Major Sweep 2026
          </div>

          {/* Bottom bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Coloured dots representing 8 players */}
            {["#dc2626", "#1e40af", "#16a34a", "#ca8a04", "#ea580c", "#9333ea", "#0891b2", "#be185d"].map(
              (c, i) => (
                <div
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: c,
                    display: "flex",
                  }}
                />
              )
            )}
            <div
              style={{
                fontSize: 14,
                color: theme.text,
                opacity: 0.3,
                marginLeft: 8,
                display: "flex",
              }}
            >
              8 friends · 4 majors · 1 champion
            </div>
          </div>
        </div>

        {/* Right: large faded emoji */}
        <div
          style={{
            position: "absolute",
            right: -20,
            bottom: -40,
            fontSize: 280,
            opacity: 0.08,
            display: "flex",
          }}
        >
          {theme.emoji}
        </div>
      </div>
    ),
    { ...size }
  );
}
