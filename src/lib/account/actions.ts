"use server";

import { createClient } from "@/lib/supabase/server";

export type AccountResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * R10: change the sign-in email. Supabase sends a confirmation to the NEW
 * address; the change only lands when that link is clicked.
 */
export async function changeEmail(formData: FormData): Promise<AccountResult> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, error: "required" };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "check_new_email" };
}

/** R10: change password for a signed-in user. */
export async function changePassword(formData: FormData): Promise<AccountResult> {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: "too_short" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "password_updated" };
}

/**
 * R10: data export — everything this person authored, as JSON. Runs under the
 * caller's own session, so RLS guarantees it can only ever return their data.
 */
export async function exportMyData(): Promise<
  { ok: true; data: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const [profile, posts, listings, comments, creatures, brands, saved] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("posts").select("*").eq("author_id", user.id),
    supabase.from("listings").select("*").eq("seller_id", user.id),
    supabase.from("comments").select("*").eq("author_id", user.id),
    // Explicit columns, not "*": anchor_value is revoked from client roles, and
    // `select *` on a table you lack a column privilege for ERRORS rather than
    // narrowing. The anchor is the owner's own data and belongs in their export,
    // so it comes back through the definer below.
    supabase
      .from("creatures")
      .select(
        "id,owner_id,name,species,slug,avatar_url,created_at,creature_role,page_visible," +
          "deceased_at,memorial_message,registration_number,birth_date,weaned_date,breed," +
          "gender,color,markings,health_notes,generation,is_founder,litter_id,archived_at,anchor_type",
      )
      .eq("owner_id", user.id),
    supabase.from("brand_memberships").select("*, brands(*)").eq("profile_id", user.id),
    supabase.from("saved_posts").select("*").eq("user_id", user.id),
  ]);

  // The anchor value is the owner's own data — a chip number they need for a vet
  // or a registry — so an export without it is incomplete. It is fetched per
  // animal through the definer because the column itself is not client-readable.
  const anchoredRows = (creatures.data ?? []) as unknown as { id: string }[];
  const anchors = await Promise.all(
    anchoredRows.map((c) =>
      supabase
        .rpc("my_creature_anchor", { target_creature: c.id })
        .then(({ data }) => [c.id, (data as string | null) ?? null] as const),
    ),
  );
  const anchorById = new Map(anchors);

  return {
    ok: true,
    data: JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, created_at: user.created_at },
        profile: profile.data ?? null,
        posts: posts.data ?? [],
        listings: listings.data ?? [],
        comments: comments.data ?? [],
        animals: ((creatures.data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
          ...c,
          anchor_value: anchorById.get(c.id as string) ?? null,
        })),
        brand_memberships: brands.data ?? [],
        saved_posts: saved.data ?? [],
      },
      null,
      2,
    ),
  };
}

/**
 * R10: account deletion request. Deleting the auth user requires service-role
 * privileges we deliberately do not hold client-side, so this records an
 * auditable request; the admin queue (R6) completes it.
 */
export async function requestAccountDeletion(): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase
    .from("account_deletion_requests")
    .insert({ profile_id: user.id });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  return { ok: true, message: "deletion_requested" };
}
