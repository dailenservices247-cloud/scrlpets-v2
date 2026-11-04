export type SponsoredCampaignData = {
  headline?: string;
  category?: string;
  ctaText?: string;
  destinationUrl?: string;
  caption?: string;
  actionLinkText?: string;
  budgetCents?: number;
  durationDays?: number;
};

export type ParsedSponsoredAd = {
  caption: string;
  headline: string;
  category: string;
  ctaText: string;
  destinationUrl: string;
  actionLinkText: string;
};

export function parseSponsoredContent(raw: string | null, fallbackId: string): ParsedSponsoredAd {
  const fallbackUrl = `/shop/product/${fallbackId}`;
  if (!raw) {
    return {
      caption: "",
      headline: "Featured Announcement",
      category: "SPONSORED",
      ctaText: "Learn more",
      destinationUrl: fallbackUrl,
      actionLinkText: "Learn more",
    };
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as SponsoredCampaignData;
      return {
        caption: parsed.caption || parsed.headline || "",
        headline: parsed.headline || "Featured Announcement",
        category: (parsed.category || "SPONSORED").toUpperCase(),
        ctaText: parsed.ctaText || "Learn more",
        destinationUrl: parsed.destinationUrl || fallbackUrl,
        actionLinkText: parsed.actionLinkText || parsed.ctaText || "Sign up",
      };
    } catch {
      // not JSON, fallback to plain string
    }
  }

  return {
    caption: raw,
    headline: raw,
    category: "SPONSORED",
    ctaText: "Shop now",
    destinationUrl: fallbackUrl,
    actionLinkText: "Learn more",
  };
}
