import { createClient } from "@/lib/supabase/server";

export type IdentityStatus = "none" | "pending" | "verified" | "failed" | "canceled";

export type SellerProgram = {
  id: string;
  programType: string;
  credentialNumber: string;
  issuingAuthority: string;
  publicUrl: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type TrustState = {
  identity: IdentityStatus;
  programs: SellerProgram[];
  buyerAttested: boolean;
  canListAnimals: boolean;
};

type ProgramRow = {
  id: string;
  program_type: string;
  credential_number: string;
  issuing_authority: string;
  public_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

/**
 * The columns a client role may read. Spelled out rather than `*` because
 * seller_programs also holds review_notes and reviewed_by, which are staff
 * text about the applicant: SELECT on those is revoked from both client roles,
 * and `*` would expand to include them and raise 42501. The decision record
 * lives in verification_events, which is admin-read-only.
 */
const PROGRAM_COLUMNS =
  "id,program_type,credential_number,issuing_authority,public_url,status,created_at";

function toProgram(r: ProgramRow): SellerProgram {
  return {
    id: r.id,
    programType: r.program_type,
    credentialNumber: r.credential_number,
    issuingAuthority: r.issuing_authority,
    publicUrl: r.public_url,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Phase 2: the viewer's own trust state (all rows are owner-readable only). */
export async function getMyTrustState(): Promise<TrustState> {
  const supabase = await createClient();
  const [identity, programs, buyer] = await Promise.all([
    supabase.from("identity_verifications").select("status").maybeSingle(),
    supabase
      .from("seller_programs")
      .select(PROGRAM_COLUMNS)
      .order("created_at", { ascending: false }),
    supabase.from("buyer_readiness").select("attested_at").maybeSingle(),
  ]);
  const status = ((identity.data as { status: IdentityStatus } | null)?.status ??
    "none") as IdentityStatus;
  return {
    identity: status,
    programs: ((programs.data ?? []) as ProgramRow[]).map(toProgram),
    buyerAttested: Boolean(buyer.data),
    // The gate also requires the specific animal to be attested; this is the
    // person-level half of it.
    canListAnimals: status === "verified",
  };
}

/** Which of these creatures the owner has attested as listable. */
export async function getAttestedCreatureIds(creatureIds: string[]): Promise<Set<string>> {
  if (creatureIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("animal_eligibility")
    .select("creature_id")
    .in("creature_id", creatureIds)
    .eq("status", "attested");
  return new Set(((data ?? []) as { creature_id: string }[]).map((r) => r.creature_id));
}

/** Admin queue: pending program submissions, oldest first. */
export async function getPendingPrograms(): Promise<
  (SellerProgram & { profileId: string })[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_programs")
    .select(`${PROGRAM_COLUMNS},profile_id`)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return ((data ?? []) as (ProgramRow & { profile_id: string })[]).map((r) => ({
    ...toProgram(r),
    profileId: r.profile_id,
  }));
}

export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}
