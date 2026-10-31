import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800";

function formatMoney(cents: number | null, currency = "USD") {
  if (cents === null || cents === undefined || cents === 0) return null;
  const sym = currency === "USD" ? "$" : currency + " ";
  return `${sym}${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function ServiceOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAnonClient();

  const { data: svc } = await supabase
    .from("services")
    .select("name,category,price_cents,currency,media_url,area,brands(name),profiles!services_owner_id_fkey(username)")
    .eq("id", id)
    .maybeSingle();

  const title = svc?.name ?? "Professional Pet Service";
  const category = svc?.category ? svc.category.toUpperCase() : "VERIFIED SERVICE";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandName = (svc?.brands as any)?.name;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerUsername = (svc?.profiles as any)?.username;
  const provider = brandName || (ownerUsername ? `@${ownerUsername}` : "Verified Provider");
  const price = formatMoney(svc?.price_cents ?? null, svc?.currency ?? "USD");
  const photo = svc?.media_url || DEFAULT_IMAGE;
  const area = svc?.area ?? null;

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
        {/* Left: Service Photo */}
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
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* Right: Service Details */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 530,
            height: 480,
            padding: "16px 0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Category / Verified Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(59, 130, 246, 0.2)",
                  color: "#60a5fa",
                  padding: "6px 16px",
                  borderRadius: 9999,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(59, 130, 246, 0.4)",
                }}
              >
                {category}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  padding: "6px 14px",
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                ✓ Escrow Protected
              </div>
            </div>

            {/* Service Name */}
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                marginBottom: 16,
                maxHeight: 140,
                overflow: "hidden",
              }}
            >
              {title}
            </div>

            {/* Area */}
            {area && (
              <div
                style={{
                  fontSize: 17,
                  color: "#94a3b8",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                📍 {area}
              </div>
            )}

            {/* Starting Price */}
            {price ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    color: "#f8fafc",
                    fontFamily: "monospace",
                  }}
                >
                  {price}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: "#94a3b8",
                    fontWeight: 500,
                  }}
                >
                  starting
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#cbd5e1",
                }}
              >
                Custom Inquiries Welcome
              </div>
            )}
          </div>

          {/* Footer: Provider Attribution + Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Service Provider
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                {provider}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 20,
                fontWeight: 900,
                color: "#f43f5e",
                letterSpacing: "-0.03em",
              }}
            >
              🐾 Scrlpets
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
