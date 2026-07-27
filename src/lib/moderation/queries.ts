import { createClient } from "@/lib/supabase/server";

export type OpenReport = {
  id: string;
  targetKind: "post" | "listing" | "profile" | "comment";
  targetId: string;
  reason: string;
  details: string | null;
  createdAt: string;
};

/** D4: the admin moderation queue. RLS returns nothing at all to non-admins. */
export async function getOpenReports(): Promise<OpenReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_reports")
    .select("id,target_kind,target_id,reason,details,created_at")
    .neq("status", "resolved")
    .order("created_at", { ascending: true })
    .limit(100);
  return ((data ?? []) as {
    id: string;
    target_kind: OpenReport["targetKind"];
    target_id: string;
    reason: string;
    details: string | null;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    targetKind: r.target_kind,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details,
    createdAt: r.created_at,
  }));
}
