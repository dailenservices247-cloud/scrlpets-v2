-- A member could rewrite their own join date.
--
-- `public.profiles` carries a blanket table-level UPDATE grant to anon and
-- authenticated, and the own-row policy's WITH CHECK pins only `id`. So the
-- policy correctly stopped you editing SOMEONE ELSE's row and said nothing
-- about which of your OWN columns you may write. Probed as a real member on
-- dev: `update profiles set created_at = '2016-01-01'` succeeded.
--
-- That is rendered as "joined" on /u/<username>. On a marketplace where
-- strangers arrange to meet and hand over an animal, a fabricated nine-year
-- tenure is a trust signal, not a cosmetic field — and it is exactly the kind
-- of claim this app has spent Phase C onwards removing.
--
-- Same remedy as 20260730194447 and 20260730200412, for the same reason: a
-- column-level `revoke update (created_at)` is a SILENT NO-OP while the role
-- holds a table-level UPDATE grant. Postgres accepts it and changes nothing.
-- The rewards lane hit that trap on this exact column and only caught it by
-- re-probing. Revoke the table grant, then grant back the allowlist.
--
-- Allowlist derived by reading every profiles writer in src/:
--   profiles/actions.ts   display_name, bio, avatar_url, cover_url
--   tree/actions.ts       tree_privacy
--   messaging/actions.ts  show_read_receipts
--   onboarding/actions.ts species_interests, onboarded_at
--   breeds_animals        operator opt-in; read in nav/operator.ts, kept
--                         writable so the opt-in path stays open
--
-- Withheld: `id` (identity), `created_at` (tenure), `username` (nothing in the
-- app updates it — it is assigned at signup, and it addresses /u/[username],
-- so a self-serve rename is both an impersonation vector and a link-rot one).

revoke update on public.profiles from anon, authenticated;

grant update (
  display_name,
  bio,
  avatar_url,
  cover_url,
  tree_privacy,
  show_read_receipts,
  species_interests,
  onboarded_at,
  breeds_animals
) on public.profiles to authenticated;

-- anon gets nothing back: an unauthenticated caller has no own row to edit, and
-- the row-level policy already refused it. This makes the grant say so too.
