import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEFAULT_IMAGE = "https://scrlpets-v2.vercel.app/brand/scrlpets-icon-512.png";

function formatMoney(cents: number | null, currency = "USD") {
  if (cents === null || cents === undefined) return null;
  const sym = currency === "USD" ? "$" : currency + " ";
  return `${sym}${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function ListingOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAnonClient();

  const { data: item } = await supabase
    .from("unified_feed")
    .select("title,price_cents,currency,photos,author_username,author_display_name,brand_name")
    .eq("id", id)
    .maybeSingle();

  const title = item?.title ?? "Verified Pet Listing";
  const seller = item?.brand_name || (item?.author_username ? `@${item.author_username}` : "Verified Seller");
  const price = formatMoney(item?.price_cents, item?.currency ?? "USD");
  const photo = Array.isArray(item?.photos) && item.photos[0] ? item.photos[0] : DEFAULT_IMAGE;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#18181b",
          padding: "60px 70px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: Animal / Product Photo */}
        <div
          style={{
            display: "flex",
            width: 480,
            height: 480,
            borderRadius: 36,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            border: "2px solid rgba(255,255,255,0.12)",
          }}
        >
          <img
            src={photo}
            alt=""
            width={480}
            height={480}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </div>

        {/* Right: Listing Details */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 530,
            gap: 20,
          }}
        >
          {/* Eyebrow Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(224, 154, 164, 0.15)",
              color: "#e09aa4",
              border: "1px solid rgba(224, 154, 164, 0.35)",
              borderRadius: 24,
              padding: "6px 16px",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              width: "fit-content",
            }}
          >
            ✓ Scrlpets Verified Listing
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: -0.5,
              maxHeight: 160,
              overflow: "hidden",
            }}
          >
            {title}
          </div>

          {/* Price Pill & Seller */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {price && (
              <div
                style={{
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 800,
                  color: "#ffffff",
                  backgroundColor: "#27272a",
                  padding: "6px 20px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {price}
              </div>
            )}
            <div
              style={{
                fontSize: 22,
                color: "#a1a1aa",
                fontWeight: 500,
              }}
            >
              by {seller}
            </div>
          </div>

          {/* Bottom Branding Tag */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 14,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <img
              src={DEFAULT_IMAGE}
              alt=""
              width={34}
              height={34}
              style={{ borderRadius: 8 }}
            />
            <div style={{ fontSize: 18, color: "#71717a", fontWeight: 600 }}>
              Scrlpets · The trusted home for animals
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
