import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default function JoinOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a237e 50%, #8a1538 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 70, marginBottom: 5 }}>⚽🏆</div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: "#d4a843",
            letterSpacing: "-2px",
            marginBottom: 5,
          }}
        >
          WC SWEEP 2026
        </div>
        <div
          style={{
            fontSize: 40,
            color: "#f5f1e8",
            fontWeight: 700,
            marginBottom: 15,
          }}
        >
          YOU&apos;RE INVITED
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 25,
          }}
        >
          {["🇺🇸", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇧🇷", "🇫🇷", "🇦🇷", "🇩🇪", "🇪🇸", "🇵🇹", "🇮🇹", "🇳🇱"].map((flag, i) => (
            <div key={i} style={{ fontSize: 36 }}>
              {flag}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 20,
            color: "#f5f1e8",
            opacity: 0.7,
            textAlign: "center",
            maxWidth: 600,
            lineHeight: 1.5,
            marginBottom: 25,
          }}
        >
          48 teams. Random draw. Tier multipliers.
          Predictions. Banter. Bragging rights.
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#0a0a0f",
            background: "#d4a843",
            borderRadius: 12,
            padding: "14px 40px",
            fontWeight: 700,
          }}
        >
          TAP TO JOIN →
        </div>
      </div>
    ),
    { ...size }
  );
}
