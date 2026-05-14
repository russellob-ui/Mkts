import { ImageResponse } from "next/og";

export const alt = "London Banter & Woody — Major Sweep 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Tournament colour schemes
const THEMES: Record<
  string,
  { bg: string; accent: string; text: string; label: string }
> = {
  masters: {
    bg: "#0a3d1f",
    accent: "#ffd700",
    text: "#f5f1e8",
    label: "The Masters",
  },
  pga: {
    bg: "#1a1a2e",
    accent: "#ffd400",
    text: "#ffffff",
    label: "PGA Championship",
  },
  "us-open": {
    bg: "#002868",
    accent: "#ffffff",
    text: "#ffffff",
    label: "U.S. Open",
  },
  open: {
    bg: "#1a1a1a",
    accent: "#c9a96e",
    text: "#f5f1e8",
    label: "The Open",
  },
};

function detectTheme(): (typeof THEMES)[string] {
  // In a static/build context we can't query the DB, so use date heuristics
  const month = new Date().getMonth() + 1; // 1-12
  if (month <= 4) return THEMES.masters;
  if (month <= 5) return THEMES.pga;
  if (month <= 6) return THEMES["us-open"];
  if (month <= 7) return THEMES.open;
  return THEMES.pga; // fallback
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.bg,
          fontFamily: "serif",
        }}
      >
        {/* Golf ball accent */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: theme.accent,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
          }}
        >
          ⛳
        </div>

        {/* Tournament name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: theme.accent,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          {theme.label}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 120,
            height: 3,
            backgroundColor: theme.accent,
            opacity: 0.4,
            marginBottom: 20,
            display: "flex",
          }}
        />

        {/* LB&W branding */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: theme.text,
            opacity: 0.9,
            marginBottom: 8,
          }}
        >
          London Banter &amp; Woody
        </div>

        <div
          style={{
            fontSize: 20,
            color: theme.text,
            opacity: 0.5,
          }}
        >
          Major Sweep 2026 · 8 friends, 4 majors, 1 champion
        </div>
      </div>
    ),
    { ...size }
  );
}
