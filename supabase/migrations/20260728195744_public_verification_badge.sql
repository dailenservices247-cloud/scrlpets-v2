-- A buyer needs to know whether a provider is identity-verified. They cannot
-- read identity_verifications — that table is owner-only and stays that way.
--
-- This returns ONE BOOLEAN's worth of information per profile: the id appears
-- in the result, or it does not. No status detail, no session reference, no
-- provider name, no document data, nothing about failed or abandoned attempts.
-- It discloses exactly what a badge already implies in public — this person
-- completed identity verification — and nothing more.

create or replace function public.verified_profile_ids(profile_ids uuid[])
returns table (profile_id uuid)
language sql stable security definer set search_path = public as $fn$
  select v.profile_id
    from public.identity_verifications v
   where v.profile_id = any(profile_ids)
     and v.status = 'verified';
$fn$;

revoke execute on function public.verified_profile_ids(uuid[]) from public;
grant execute on function public.verified_profile_ids(uuid[]) to anon, authenticated;
