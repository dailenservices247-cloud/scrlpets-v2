-- Self-serve rename, answering both objections 20260801171418 raised.
--
-- That migration withheld `username` from the self-writable allowlist because a
-- rename is "both an impersonation vector and a link-rot one". Both are real.
-- Neither is answered by trusting the caller, so both are answered here:
--
--   IMPERSONATION -> a released handle is RETAINED forever in username_history
--                    and can never be claimed by another account. Only its
--                    original owner may reclaim it.
--   LINK ROT      -> history maps a retired handle to its owner, so /u/<old>
--                    can resolve and redirect instead of 404ing.
--
-- The column stays revoked from `authenticated`. Renaming goes through a
-- definer function so the rules cannot be bypassed by writing the column
-- directly — the same shape as every other guarded write in this schema.

create table if not exists public.username_history (
  -- PK, so a retired handle is globally unique across history and can never be
  -- handed to a second account.
  username     text primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  released_at  timestamptz not null default now()
);

create index if not exists idx_username_history_profile
  on public.username_history using btree (profile_id);

alter table public.username_history enable row level security;

-- Readable so /u/<old-handle> can resolve to a redirect for signed-out
-- visitors. It holds no more than the public profile page already shows.
drop policy if exists "read username history" on public.username_history;
create policy "read username history" on public.username_history
for select to anon, authenticated using (true);

-- No write policy: rows are created by the definer function below, never by a
-- client. A client-writable history table would let anyone reserve any handle.

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

/**
 * Rename yourself.
 *
 * Rules live here rather than in the app because `username` is revoked from
 * `authenticated` by design — this function is the only write path, so it is
 * also the only place the rules can be enforced.
 *
 * Mirrors src/lib/profiles/username.ts. The two are kept in step by
 * `username_rename.probe.sql`, which asserts the same refusals this function
 * raises.
 */
create or replace function public.set_username(new_username text)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid      uuid := auth.uid();
  candidate text;
  current_name text;
  changed  timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  -- Fold case FIRST: checking reserved words before lowercasing lets "Admin"
  -- through, which is the whole impersonation surface this guards.
  candidate := lower(btrim(new_username));

  if length(candidate) < 3 or length(candidate) > 30 then
    raise exception 'username_length';
  end if;
  if candidate !~ '^[a-z0-9_]+$' then raise exception 'username_format'; end if;
  if candidate !~ '^[a-z]'       then raise exception 'username_leading'; end if;
  if candidate in ('admin','administrator','help','mod','moderator','official',
                   'root','scrlpets','staff','support','system','team') then
    raise exception 'username_reserved';
  end if;

  select username, username_changed_at into current_name, changed
    from public.profiles where id = uid;
  if current_name is null then raise exception 'profile_missing'; end if;
  if candidate = current_name then return; end if;

  -- Burning handles is griefing: every rename retires a name permanently, so
  -- without a cooldown one account could exhaust the namespace.
  if changed is not null and changed > now() - interval '30 days' then
    raise exception 'username_cooldown';
  end if;

  -- Live handles are taken.
  if exists (select 1 from public.profiles where username = candidate and id <> uid) then
    raise exception 'username_taken';
  end if;
  -- Retired handles belong to whoever released them, forever. Reclaiming your
  -- own is allowed; taking someone else's is the impersonation vector.
  if exists (
    select 1 from public.username_history
     where username = candidate and profile_id <> uid
  ) then
    raise exception 'username_taken';
  end if;

  -- Retain the outgoing handle before overwriting it.
  insert into public.username_history (username, profile_id)
  values (current_name, uid)
  on conflict (username) do update set profile_id = excluded.profile_id,
                                       released_at = now();

  update public.profiles
     set username = candidate, username_changed_at = now()
   where id = uid;

  -- Reclaiming your own retired handle takes it out of history, so it is live
  -- again rather than being both current and retired.
  delete from public.username_history where username = candidate and profile_id = uid;
end; $fn$;

revoke execute on function public.set_username(text) from anon, public;
grant  execute on function public.set_username(text) to authenticated;
