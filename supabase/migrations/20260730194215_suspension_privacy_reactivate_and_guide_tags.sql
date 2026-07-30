-- Three things the Phase E build surfaced.

-- 1. Suspension reasons were world-readable.
--
-- `create policy "read suspensions" ... using (true)` meant the anon key could
-- read every row of account_suspensions — including `reason`, which is
-- admin-written text ABOUT a member, and `actor_id`, which names the admin who
-- wrote it. Probed as anon on dev: the internal reason came back in full.
--
-- The intent was presumably that a suspended person can see they are suspended.
-- That is preserved; what goes away is everyone else reading it. is_suspended()
-- is SECURITY DEFINER, so every existing gate that merely asks "is this account
-- suspended?" keeps working for all callers.
drop policy if exists "read suspensions" on public.account_suspensions;

create policy "read own suspension or admin" on public.account_suspensions
for select to authenticated
using (
  profile_id = (select auth.uid())
  or public.is_platform_admin()
);

-- 2. Reactivation had no write path at all.
--
-- account_suspensions had a SELECT policy and nothing else, so a client DELETE
-- matched zero rows and returned no error — a "reactivate" button would have
-- silently done nothing while looking like it worked. moderation_actions
-- already allows 'account_unsuspended', so the audit trail was ready and only
-- the write was missing.
create or replace function public.reactivate_account(target_profile uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not public.is_platform_admin() then
    raise exception 'admin_required';
  end if;
  if length(btrim(coalesce(reason, ''))) < 4 then
    raise exception 'reason_required';
  end if;

  delete from public.account_suspensions where profile_id = target_profile;
  if not found then
    raise exception 'not_suspended';
  end if;

  -- Lifting a suspension is a moderation decision and is recorded like one.
  insert into public.moderation_actions (actor_id, action, target_kind, target_id, notes)
  values (uid, 'account_unsuspended', 'profile', target_profile, btrim(reason));
end;
$$;

revoke execute on function public.reactivate_account(uuid, text) from anon, public;
grant execute on function public.reactivate_account(uuid, text) to authenticated;

-- 3. Nothing could set a guide's category or species.
--
-- 20260730190319 added guides.category/species and the reading side filters on
-- them, but upsert_guide — the only write path, since guides has no client
-- write policy — took neither. Every guide's tags would have stayed NULL
-- forever and the filters would have had nothing to filter, which is the
-- "ships looking complete, does nothing" failure this rebuild keeps correcting.
--
-- Added as trailing DEFAULT NULL parameters so the existing 6-argument call in
-- src/lib/guides/actions.ts keeps resolving to this same function rather than
-- creating an ambiguous overload.
-- Everything except the two new columns is carried over verbatim from the
-- existing definition: it RETURNS uuid (CREATE OR REPLACE cannot change that,
-- and the caller uses the id), and re-publishing keeps the ORIGINAL
-- published_at via coalesce rather than resetting it. Both were nearly lost by
-- rewriting this from the signature instead of reading the body.
create or replace function public.upsert_guide(
  guide_slug text,
  guide_title text,
  guide_summary text,
  guide_body text,
  guide_audience text,
  publish boolean default false,
  guide_category text default null,
  guide_species text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare gid uuid;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  insert into public.guides (slug, title, summary, body, audience, published_at, category, species)
  values (guide_slug, guide_title, guide_summary, guide_body, guide_audience,
          case when publish then now() else null end,
          nullif(btrim(coalesce(guide_category, '')), ''),
          nullif(btrim(coalesce(guide_species, '')), ''))
  on conflict (slug) do update
    set title = excluded.title, summary = excluded.summary, body = excluded.body,
        audience = excluded.audience, updated_at = now(),
        category = excluded.category, species = excluded.species,
        published_at = case when publish then coalesce(public.guides.published_at, now()) else null end
  returning id into gid;
  return gid;
end; $function$;
