import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Absolute URL required inside ImageResponse. Update at DNS cutover.
const MARK = "https://scrlpets-v2.vercel.app/brand/scrlpets-mark-full.png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a2a2d",
          gap: 56,
          paddingLeft: 48,
          paddingRight: 48,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK} width={520} height={520} alt="" style={{ borderRadius: 48 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 480 }}>
          <div style={{ fontSize: 72, fontWeight: 600, color: "#efede5" }}>Scrlpets</div>
          <div style={{ fontSize: 34, color: "#e09aa4", lineHeight: 1.3 }}>
            The trusted home for animals.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
