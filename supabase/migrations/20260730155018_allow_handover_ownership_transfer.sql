-- Completes 20260730154143, which on its own was worse than the bug.
--
-- That migration taught pack_alumni_on_handover to move creatures.owner_id to
-- the buyer. But enforce_creature_identity_immutable (Phase A) raises
-- `creature_owner_immutable` on ANY owner_id change, so the transfer threw
-- inside the handover trigger — meaning the second confirmation of a handover
-- would have failed outright. Worse than the stale-owner bug it was fixing.
-- Caught by probing a real confirmed handover rather than trusting the push.
--
-- Ownership was locked for a good reason: an owner must not be able to rewrite
-- which account an animal belongs to. That protection is aimed at CLIENTS. A
-- both-sides-confirmed handover is exactly the case where ownership is supposed
-- to move, and it runs inside a SECURITY DEFINER trigger.
--
-- So the lock now applies to client roles only. Under SECURITY DEFINER,
-- current_user is the function owner; a request from the app runs as
-- `authenticated` (or `anon`). Checking current_user therefore distinguishes
-- "the app is trying to reassign an animal" from "verified server logic is
-- completing a handover", and unlike a session flag it cannot be spoofed by a
-- client, since a client has no way to change the role it runs as.
--
-- slug stays immutable for everyone: nothing legitimate renames it.

create or replace function public.enforce_creature_identity_immutable()
returns trigger
language plpgsql
as $function$
begin
  if new.owner_id is distinct from old.owner_id
     and current_user in ('authenticated', 'anon') then
    raise exception 'creature_owner_immutable';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'creature_slug_immutable';
  end if;
  return new;
end; $function$;
