"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

export type CampaignInput = {
  brandId?: string | null;
  caption: string;
  headline: string;
  category: string;
  ctaText: string;
  destinationUrl: string;
  mediaUrl: string;
  actionLinkText?: string;
  tier: "starter" | "growth" | "pro" | "elite";
};

export async function createSponsoredCampaignAction(input: CampaignInput): Promise<{
  ok: boolean;
  error?: string;
  promoId?: string;
}> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Authentication required to launch promotions." };
  }

  if (!input.headline.trim()) {
    return { ok: false, error: "Headline is required." };
  }

  if (!input.destinationUrl.trim()) {
    return { ok: false, error: "Destination link is required." };
  }

  const budgetCents =
    input.tier === "elite"
      ? 10000
      : input.tier === "pro"
      ? 5000
      : input.tier === "growth"
      ? 2500
      : 1000;

  const durationDays =
    input.tier === "elite"
      ? 30
      : input.tier === "pro"
      ? 14
      : input.tier === "growth"
      ? 7
      : 3;

  const titlePayload = JSON.stringify({
    caption: input.caption.trim(),
    headline: input.headline.trim(),
    category: (input.category || "SPONSORED").toUpperCase().trim(),
    ctaText: input.ctaText || "Learn more",
    destinationUrl: input.destinationUrl.trim(),
    actionLinkText: input.actionLinkText?.trim() || input.ctaText || "Sign up",
    tier: input.tier,
    budgetCents,
    durationDays,
    brandId: input.brandId ?? null,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promos")
    .insert({
      author_id: user.id,
      title: titlePayload,
      media_url: input.mediaUrl.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to launch promotion." };
  }

  revalidatePath("/brand-os");
  revalidatePath("/");

  return { ok: true, promoId: data.id };
}
