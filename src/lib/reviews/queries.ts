import { createClient } from "@/lib/supabase/server";

export type Review = {
  id: string;
  applicationId: string;
  reviewerId: string;
  subjectId: string;
  rating: number;
  accuracyRating: number | null;
  communicationRating: number | null;
  healthRating: number | null;
  title: string | null;
  body: string | null;
  createdAt: string;
  reviewerUsername: string | null;
};

export type ReviewSummary = {
  count: number;
  average: number | null;
  accuracy: number | null;
  communication: number | null;
  health: number | null;
};

type Row = {
  id: string;
  application_id: string;
  reviewer_id: string;
  subject_id: string;
  rating: number;
  accuracy_rating: number | null;
  communication_rating: number | null;
  health_rating: number | null;
  title: string | null;
  body: string | null;
  created_at: string;
  profiles: { username: string } | null;
};

const SELECT =
  "id,application_id,reviewer_id,subject_id,rating,accuracy_rating," +
  "communication_rating,health_rating,title,body,created_at," +
  "profiles!reviews_reviewer_id_fkey(username)";

function toReview(r: Row): Review {
  return {
    id: r.id,
    applicationId: r.application_id,
    reviewerId: r.reviewer_id,
    subjectId: r.subject_id,
    rating: r.rating,
    accuracyRating: r.accuracy_rating,
    communicationRating: r.communication_rating,
    healthRating: r.health_rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    reviewerUsername: r.profiles?.username ?? null,
  };
}

/**
 * Every review here is verified by construction: the insert policy requires a
 * handover both parties confirmed, so there is no unverified review to
 * distinguish these from.
 */
export async function getReviewsFor(subjectId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(SELECT)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as Row[]).map(toReview);
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10;
}

/** Plain arithmetic over real reviews. Nothing weighted, nothing purchasable. */
export function summarize(reviews: Review[]): ReviewSummary {
  return {
    count: reviews.length,
    average: mean(reviews.map((r) => r.rating)),
    accuracy: mean(reviews.map((r) => r.accuracyRating)),
    communication: mean(reviews.map((r) => r.communicationRating)),
    health: mean(reviews.map((r) => r.healthRating)),
  };
}

/** Handovers the viewer may still review, newest first. */
export async function getReviewableHandovers(): Promise<
  { applicationId: string; sellerId: string; sellerUsername: string | null; listingTitle: string | null }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("buyer_applications")
    .select(
      "id,seller_id,listings(title),seller:profiles!buyer_applications_seller_id_fkey(username)",
    )
    .eq("buyer_id", user.id)
    .eq("status", "accepted")
    .not("buyer_confirmed_at", "is", null)
    .not("seller_confirmed_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (data ?? []) as unknown as {
    id: string;
    seller_id: string;
    listings: { title: string } | null;
    seller: { username: string } | null;
  }[];
  if (rows.length === 0) return [];

  // Drop the ones already reviewed.
  const { data: existing } = await supabase
    .from("reviews")
    .select("application_id")
    .in("application_id", rows.map((r) => r.id));
  const reviewed = new Set(
    ((existing ?? []) as { application_id: string }[]).map((r) => r.application_id),
  );

  return rows
    .filter((r) => !reviewed.has(r.id))
    .map((r) => ({
      applicationId: r.id,
      sellerId: r.seller_id,
      sellerUsername: r.seller?.username ?? null,
      listingTitle: r.listings?.title ?? null,
    }));
}
