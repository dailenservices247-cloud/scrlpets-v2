import { ImageResponse } from "next/og";
import { createAnonClient } from "@/lib/supabase/anon";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEFAULT_IMAGE = "https://scrlpets-v2.vercel.app/brand/scrlpets-icon-512.png";

export default async function CreatureOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAnonClient();

  const { data: creature } = await supabase
    .from("creatures")
    .select("name,species,breed,gender,avatar_url,anchor_type")
    .eq("slug", slug)
    .maybeSingle();

  const name = creature?.name ?? "Animal Profile";
  const breed = creature?.breed || creature?.species || "Purebred";
  const gender = creature?.gender ? ` · ${creature.gender.charAt(0).toUpperCase() + creature.gender.slice(1)}` : "";
  const photo = creature?.avatar_url || DEFAULT_IMAGE;

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
        {/* Left: Creature Portrait */}
        <div
          style={{
            display: "flex",
            width: 480,
            height: 480,
            borderRadius: 40,
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

        {/* Right: Pedigree & Identity */}
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
            🐾 Verified Animal Pedigree
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: -0.5,
            }}
          >
            {name}
          </div>

          {/* Breed & Species Subtitle */}
          <div
            style={{
              fontSize: 26,
              color: "#d4d4d8",
              fontWeight: 600,
            }}
          >
            {breed}
            {gender}
          </div>

          {/* Anchor Status */}
          {creature?.anchor_type && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 18,
                color: "#10b981",
                fontWeight: 600,
              }}
            >
              ✓ Verified Identity: {creature.anchor_type.toUpperCase()}
            </div>
          )}

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
