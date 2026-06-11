import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          background: "#2a2a2d",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg viewBox="0 0 44 60" width="110" height="150">
            <path
              d="M 36 12 C 32 5, 19 3, 12 9 C 5 15, 8 23, 16 26 C 25 29, 35 31, 37 40 C 39 50, 29 57, 19 55 C 12.5 53.6, 8.5 48.5, 9.5 43.5"
              fill="none"
              stroke="#7e303a"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 9.5 43.5 C 10.5 39.5, 16 39.5, 16.5 43.5 C 16.9 46.7, 13 48.2, 11.2 46"
              fill="none"
              stroke="#a0414e"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: 120, fontWeight: 600, color: "#efede5", marginLeft: 6 }}>
            crlpets
          </div>
        </div>
        <div style={{ fontSize: 32, color: "#9b9b96" }}>The trusted home for animals.</div>
      </div>
    ),
    { ...size },
  );
}
