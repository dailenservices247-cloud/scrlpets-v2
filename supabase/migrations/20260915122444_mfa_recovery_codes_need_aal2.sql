-- Minting recovery codes now requires a session that has passed its second factor.
--
-- Found 2026-09-14 on dev: an aal1 session — a password alone — minted ten codes
-- and spent one. `consume_mfa_recovery_code` stays callable at aal1 on purpose
-- (it is the way back in after a lost phone), and a spent code lets
-- `recoverWithCode` delete the factor with the service role. So while minting
-- was open at aal1, someone holding only the password could mint, spend and
-- strip the second factor, and no sign-in challenge could stop it.
--
-- Enrolment is unaffected: MfaPanel mints codes straight after
-- challengeAndVerify, which has just made the session aal2.
--
-- `create or replace` keeps the existing grants: authenticated only.

create or replace function public.generate_mfa_recovery_codes()
returns table (code text)
language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); raw text; i integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'aal2_required';
  end if;

  -- Regenerating invalidates everything previously issued, used or not.
  delete from public.mfa_recovery_codes where profile_id = uid;

  for i in 1..10 loop
    -- 10 hex characters, grouped for transcription by someone reading them off
    -- paper under stress.
    raw := substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 5)
        || '-' ||
           substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 5);
    insert into public.mfa_recovery_codes (profile_id, code_hash)
    values (uid, extensions.crypt(raw, extensions.gen_salt('bf')));
    code := raw;
    return next;
  end loop;
end; $fn$;
