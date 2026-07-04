import { createClient } from "@/lib/supabase/server";
import { getBrandRole } from "@/lib/brands/queries";
import { canManageBrandContent } from "@/lib/brands/types";

export type LockedAttribution = {
  postingAsType: "person" | "brand";
  postingAsLabel: string;
  aboutType: string;
  aboutLabel: string;
};

export type EditablePost = {
  kind: "post";
  id: string;
  contentType: "post" | "reel" | "long_video";
  body: string;
  mediaUrl: string | null;
  attribution: LockedAttribution;
};

export type EditableListing = {
  kind: "listing";
  id: string;
  title: string;
  price: string;
  mediaUrl: string | null;
  attribution: LockedAttribution;
};

type AttributionRow = {
  posting_as_type: "person" | "brand";
  brand_id: string | null;
  about_type: string;
  about_id: string | null;
};

async function resolveAttribution(
  row: AttributionRow,
  creatureId: string | null,
): Promise<LockedAttribution> {
  const supabase = await createClient();
  const [{ data: brand }, { data: creature }] = await Promise.all([
    row.brand_id
      ? supabase.from("brands").select("name").eq("id", row.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    creatureId
      ? supabase.from("creatures").select("name").eq("id", creatureId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const postingAsLabel =
    row.posting_as_type === "brand"
      ? (brand?.name ?? "Brand")
      : "Personal profile";
  const aboutLabel =
    row.about_type === "animal"
      ? (creature?.name ?? "Animal")
      : row.about_type === "none"
        ? "No specific object"
        : row.about_type.replaceAll("_", " ");

  return {
    postingAsType: row.posting_as_type,
    postingAsLabel,
    aboutType: row.about_type,
    aboutLabel,
  };
}

export async function getEditablePost(
  postId: string,
  viewerId: string,
): Promise<EditablePost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id,author_id,content_type,body,media_url,tagged_creature_id,posting_as_type,brand_id,about_type,about_id",
    )
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const role =
    data.posting_as_type === "brand" && data.brand_id
      ? await getBrandRole(viewerId, data.brand_id)
      : null;
  if (data.author_id !== viewerId && !canManageBrandContent(role)) return null;

  return {
    kind: "post",
    id: data.id,
    contentType: data.content_type,
    body: data.body ?? "",
    mediaUrl: data.media_url,
    attribution: await resolveAttribution(data, data.tagged_creature_id),
  };
}

export async function getEditableListing(
  listingId: string,
  viewerId: string,
): Promise<EditableListing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id,seller_id,title,price_cents,media_url,creature_id,posting_as_type,brand_id,about_type,about_id,deleted_at",
    )
    .eq("id", listingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const role =
    data.posting_as_type === "brand" && data.brand_id
      ? await getBrandRole(viewerId, data.brand_id)
      : null;
  if (data.seller_id !== viewerId && !canManageBrandContent(role)) return null;

  return {
    kind: "listing",
    id: data.id,
    title: data.title,
    price: (data.price_cents / 100).toFixed(2),
    mediaUrl: data.media_url,
    attribution: await resolveAttribution(data, data.creature_id),
  };
}
