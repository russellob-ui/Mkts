import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          backgroundColor: "#0a0a0f",
          borderRadius: "32px",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 4 }}>&#9917;</div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#d4a843",
            letterSpacing: "-2px",
            fontFamily: "Georgia, serif",
          }}
        >
          WC
        </div>
      </div>
    ),
    { ...size }
  );
}
