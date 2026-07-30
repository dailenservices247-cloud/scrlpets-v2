import { createClient } from "@/lib/supabase/server";

/** The two statuses the table actually allows — read them, never invent a third. */
export type PackStatus = "pending" | "accepted";
export type PackOrigin = "invite" | "handover";

export type PackPerson = {
  linkId: string;
  profileId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  origin: PackOrigin;
  /** accepted_at for members, created_at for pending requests. */
  at: string;
};

export type PackOverview = { members: PackPerson[]; incoming: PackPerson[] };

type LinkRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: PackStatus;
  origin: PackOrigin;
  created_at: string;
  accepted_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * The viewer's pack in two round trips.
 *
 * ponytail: resolves the counterparty profiles with a second `in(...)` query
 * instead of two disambiguated PostgREST embeds off the same table. pack_links
 * has two FKs into profiles, so the embed needs both constraint names spelled
 * correctly; the id sweep is the same shape `countMembers` in lib/groups uses
 * and cannot silently return the wrong side. Move to an embed if a pack ever
 * gets big enough that the extra round trip shows up.
 *
 * Outgoing pending invites are deliberately NOT listed: nothing in this lane
 * can create one (there is no invite composer yet), so a "sent" section would
 * be permanently empty. Add it with the invite entry point.
 */
export async function getPackOverview(viewerId: string): Promise<PackOverview> {
  const supabase = await createClient();
  // RLS already scopes pack_links to the two parties; the filter is kept
  // explicit so the query still reads correctly if the policy ever widens.
  const { data } = await supabase
    .from("pack_links")
    .select("id,requester_id,addressee_id,status,origin,created_at,accepted_at")
    .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as LinkRow[];
  if (rows.length === 0) return { members: [], incoming: [] };

  const otherId = (r: LinkRow) => (r.requester_id === viewerId ? r.addressee_id : r.requester_id);
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .in("id", [...new Set(rows.map(otherId))]);
  const profiles = new Map(
    ((profileData ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const toPerson = (r: LinkRow): PackPerson | null => {
    const p = profiles.get(otherId(r));
    // A profile that vanished between the two reads has no honest row to show.
    if (!p) return null;
    return {
      linkId: r.id,
      profileId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      origin: r.origin,
      at: r.accepted_at ?? r.created_at,
    };
  };

  const members: PackPerson[] = [];
  const incoming: PackPerson[] = [];
  for (const r of rows) {
    const person = toPerson(r);
    if (!person) continue;
    if (r.status === "accepted") members.push(person);
    else if (r.addressee_id === viewerId) incoming.push(person);
  }
  return { members, incoming };
}

export type PackLinkState = { status: PackStatus; addresseeId: string };

/**
 * One link's live state, for surfaces that only hold a link id — notably a
 * `pack_invite` notification, which outlives the request it points at. RLS
 * returns nothing to anyone but the two parties.
 */
export async function getPackLinkState(linkId: string): Promise<PackLinkState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pack_links")
    .select("status,addressee_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { status: PackStatus; addressee_id: string };
  return { status: row.status, addresseeId: row.addressee_id };
}
