-- Recovery codes, so a lost phone is not a lost account.
--
-- Supabase mints no recovery codes of its own. TOTP without them is a
-- permanent-lockout generator, and `reactivate_account` does not help because
-- the account is not suspended — it is simply unreachable.
--
-- WHY THIS EXISTS RATHER THAN A BYPASS: a code stored here cannot make Supabase
-- issue an AAL2 session; nothing in this schema can. What a verified code DOES
-- is authorise the app to delete the TOTP factor with the service role, after
-- which the member signs in with their password alone and re-enrols. The code
-- proves who they are; Supabase still decides what a session is worth.
--
-- HASHED, and unreadable by anyone. bcrypt via pgcrypto, and the table is
-- revoked from every client role — there is no SELECT policy, deliberately.
-- An admin who can read recovery codes is an admin who can take any account,
-- and support staff who can read them will be asked to.

create table if not exists public.mfa_recovery_codes (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz default now() not null,
  constraint mfa_recovery_codes_pkey primary key (id)
);

create index if not exists idx_mfa_recovery_unused
  on public.mfa_recovery_codes (profile_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

-- No policies at all. Not an oversight: with RLS enabled and no permissive
-- policy, every client role reads and writes nothing, and only the definers
-- below can reach the rows.
revoke all on public.mfa_recovery_codes from anon, authenticated;

/**
 * Mint ten single-use codes and return them ONCE, in plaintext.
 *
 * The plaintext exists only in this result set. Only bcrypt hashes are stored,
 * so a second call cannot re-show them — it replaces them, which is the correct
 * behaviour: regenerating must invalidate every code the member may have
 * written down somewhere they no longer control.
 */
create or replace function public.generate_mfa_recovery_codes()
returns table (code text)
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); raw text; i integer;
begin
  if uid is null then raise exception 'auth_required'; end if;

  -- Regenerating invalidates everything previously issued, used or not.
  delete from public.mfa_recovery_codes where profile_id = uid;

  for i in 1..10 loop
    -- 10 hex characters, grouped for transcription by someone reading them off
    -- paper under stress. 40 bits: far beyond guessable against a hashed,
    -- single-use, ten-row set, and short enough to type correctly.
    raw := substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 5)
        || '-' ||
           substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 5);
    insert into public.mfa_recovery_codes (profile_id, code_hash)
    values (uid, extensions.crypt(raw, extensions.gen_salt('bf')));
    code := raw;
    return next;
  end loop;
end; $fn$;

revoke execute on function public.generate_mfa_recovery_codes() from anon, public;
grant execute on function public.generate_mfa_recovery_codes() to authenticated;

/**
 * Spend one code. Returns true exactly once per code, ever.
 *
 * Callable at AAL1 on purpose — a member locked out of their second factor
 * still holds a password session, and that is the only state from which this is
 * ever useful.
 */
create or replace function public.consume_mfa_recovery_code(candidate text)
returns boolean
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); hit uuid;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if candidate is null or btrim(candidate) = '' then return false; end if;

  -- crypt() re-hashes with the stored salt, so the comparison is against the
  -- hash and never the plaintext.
  select id into hit
    from public.mfa_recovery_codes
   where profile_id = uid
     and used_at is null
     and code_hash = extensions.crypt(btrim(candidate), code_hash)
   limit 1;

  if hit is null then return false; end if;

  update public.mfa_recovery_codes set used_at = now() where id = hit;
  return true;
end; $fn$;

revoke execute on function public.consume_mfa_recovery_code(text) from anon, public;
grant execute on function public.consume_mfa_recovery_code(text) to authenticated;

/** How many codes remain, so the UI can nag before the last one is spent. */
create or replace function public.mfa_recovery_codes_remaining()
returns integer
language sql stable security definer set search_path = public as $fn$
  select count(*)::integer from public.mfa_recovery_codes
   where profile_id = (select auth.uid()) and used_at is null;
$fn$;

revoke execute on function public.mfa_recovery_codes_remaining() from anon, public;
grant execute on function public.mfa_recovery_codes_remaining() to authenticated;
