import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Absolute URL required inside ImageResponse. Square crop avoids distortion. Update at DNS cutover.
const MARK = "https://scrlpets-v2.vercel.app/brand/scrlpets-icon-square.png";

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
          paddingLeft: 64,
          paddingRight: 64,
        }}
      >
        {/* Mark already contains the wordmark — pair it only with the tagline. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK} width={480} height={480} alt="" style={{ borderRadius: 40 }} />
        <div style={{ display: "flex", maxWidth: 440 }}>
          <div style={{ fontSize: 44, color: "#e09aa4", lineHeight: 1.3 }}>
            The trusted home for animals.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
