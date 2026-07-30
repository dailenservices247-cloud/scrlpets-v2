import { createClient } from "@/lib/supabase/server";
import { speciesIdentity } from "@/lib/species/identity";

/** Which side of the handover the viewer (or a post's author) is on. */
export type AlumniSide = "breeder" | "owner";

export type AlumniPerson = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type AlumniRecord = {
  id: string;
  breederId: string;
  ownerId: string;
  viewerSide: AlumniSide;
  counterparty: AlumniPerson | null;
  /** Null when the animal's profile has been deleted (creature_id is ON DELETE SET NULL). */
  creature: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
  /**
   * Species-adapted label for the side that raised the animal — "Kennel",
   * "Cattery", "Aviary", "Herpetarium", or plain "Breeder" when the species is
   * unknown. This is the whole reason the milestone vocabulary can stay
   * species-neutral: the ROLE carries the species, so the entries never have to.
   */
  breederRoleBadge: string;
  handoverAt: string;
  /** The viewer's own mute flag — never the other party's. */
  muted: boolean;
};

type AlumniRow = {
  id: string;
  breeder_id: string;
  owner_id: string;
  handover_at: string;
  muted_by_breeder: boolean;
  muted_by_owner: boolean;
  creatures: {
    id: string;
    name: string;
    slug: string;
    species: string | null;
    avatar_url: string | null;
  } | null;
};

const ALUMNI_SELECT =
  "id,breeder_id,owner_id,handover_at,muted_by_breeder,muted_by_owner," +
  "creatures(id,name,slug,species,avatar_url)";

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function loadProfiles(ids: string[]): Promise<Map<string, AlumniPerson>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .in("id", ids);
  return new Map(
    ((data ?? []) as ProfileRow[]).map((p) => [
      p.id,
      { id: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url },
    ]),
  );
}

function toRecord(
  row: AlumniRow,
  viewerId: string,
  profiles: Map<string, AlumniPerson>,
): AlumniRecord {
  const viewerSide: AlumniSide = row.breeder_id === viewerId ? "breeder" : "owner";
  const counterpartyId = viewerSide === "breeder" ? row.owner_id : row.breeder_id;
  return {
    id: row.id,
    breederId: row.breeder_id,
    ownerId: row.owner_id,
    viewerSide,
    counterparty: profiles.get(counterpartyId) ?? null,
    creature: row.creatures
      ? {
          id: row.creatures.id,
          name: row.creatures.name,
          slug: row.creatures.slug,
          avatarUrl: row.creatures.avatar_url,
        }
      : null,
    breederRoleBadge: speciesIdentity(row.creatures?.species).roleBadge,
    handoverAt: row.handover_at,
    muted: viewerSide === "breeder" ? row.muted_by_breeder : row.muted_by_owner,
  };
}

/** Every animal the viewer handed over or received. RLS scopes it to the two parties. */
export async function listAlumni(viewerId: string): Promise<AlumniRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alumni")
    .select(ALUMNI_SELECT)
    .order("handover_at", { ascending: false });
  // RLS already refuses non-parties; the filter keeps `viewerSide` from being
  // computed — and rendered — for a row the viewer is not actually part of.
  const rows = ((data ?? []) as unknown as AlumniRow[]).filter(
    (r) => r.breeder_id === viewerId || r.owner_id === viewerId,
  );
  const profiles = await loadProfiles([
    ...new Set(rows.map((r) => (r.breeder_id === viewerId ? r.owner_id : r.breeder_id))),
  ]);
  return rows.map((r) => toRecord(r, viewerId, profiles));
}

export async function getAlumniRecord(
  id: string,
  viewerId: string,
): Promise<AlumniRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("alumni").select(ALUMNI_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as AlumniRow;
  // RLS already refuses non-parties, so a returned row means the viewer is one
  // of the two — but viewerSide must not be inferred from that alone.
  if (row.breeder_id !== viewerId && row.owner_id !== viewerId) return null;
  const profiles = await loadProfiles([
    row.breeder_id === viewerId ? row.owner_id : row.breeder_id,
  ]);
  return toRecord(row, viewerId, profiles);
}

export type AlumniUpdate = {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
  author: AlumniPerson;
  /** Derived from the post's OWN author_id, never from who is reading. */
  authorSide: AlumniSide;
};

type UpdateRow = {
  id: string;
  body: string | null;
  media_url: string | null;
  created_at: string;
  author_id: string;
  profiles: ProfileRow | ProfileRow[] | null;
};

/**
 * The two-sided timeline.
 *
 * An update here is not a new entity: it is an ordinary post tagged to the
 * animal (posts.tagged_creature_id), which is why it also appears on the
 * animal's own page and in the feed with no extra plumbing. `about_type` stays
 * `none` — the animal-flavoured enum value was deliberately removed in
 * 20260723025415 because the FK column already IS the animal reference.
 *
 * Sender identity comes from the post's author profile joined on author_id and
 * nothing else. Legacy attributed these to whoever's timeline you were looking
 * at, so both parties saw their own name on the other's updates; deriving the
 * side by comparing the real author_id against the alumni row is what stops
 * that from being expressible.
 */
export async function listAlumniUpdates(record: AlumniRecord): Promise<AlumniUpdate[]> {
  if (!record.creature) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      "id,body,media_url,created_at,author_id,profiles!posts_author_id_fkey(id,username,display_name,avatar_url)",
    )
    .eq("tagged_creature_id", record.creature.id)
    .in("author_id", [record.breederId, record.ownerId])
    .order("created_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as unknown as UpdateRow[]).flatMap((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    // No author profile means no honest attribution, so the entry is dropped
    // rather than rendered as "Someone".
    if (!p) return [];
    return [
      {
        id: r.id,
        body: r.body,
        mediaUrl: r.media_url,
        createdAt: r.created_at,
        author: {
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
        },
        authorSide: (r.author_id === record.breederId ? "breeder" : "owner") as AlumniSide,
      },
    ];
  });
}
