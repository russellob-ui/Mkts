import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default function OgImage() {
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
        <div style={{ fontSize: 80, marginBottom: 10 }}>⚽🏆</div>
        <div
          style={{
            fontSize: 72,
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
            fontSize: 28,
            color: "#f5f1e8",
            opacity: 0.8,
            marginBottom: 30,
          }}
        >
          FIFA World Cup 2026 Sweepstake
        </div>
        <div
          style={{
            display: "flex",
            gap: 15,
            marginBottom: 30,
          }}
        >
          {["🇺🇸", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇧🇷", "🇫🇷", "🇦🇷", "🇩🇪", "🇪🇸", "🇵🇹"].map((flag, i) => (
            <div key={i} style={{ fontSize: 40 }}>
              {flag}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#d4a843",
            border: "2px solid #d4a843",
            borderRadius: 12,
            padding: "12px 30px",
            fontWeight: 700,
          }}
        >
          JOIN THE SWEEP →
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#f5f1e8",
            opacity: 0.4,
            marginTop: 20,
          }}
        >
          Friends · Teams · Glory · Bragging Rights Only
        </div>
      </div>
    ),
    { ...size }
  );
}
