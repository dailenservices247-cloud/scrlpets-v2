export type SellerRecommendationContext = "profile" | "listing_detail" | "post_sale_message";

export type SellerRecommendationSlot = {
  context: SellerRecommendationContext;
  sellerId: string;
  creatureId?: string;
  listingId?: string;
  messageThreadId?: string;
};

export const SELLER_RECOMMENDATION_CONTEXTS = [
  "profile",
  "listing_detail",
  "post_sale_message",
] as const satisfies readonly SellerRecommendationContext[];
