-- The database half of the sign-in challenge.
--
-- proxy.ts sends a session that still owes its second factor to /two-factor,
-- but the project URL and public key ship in every browser: someone holding
-- only the password can skip the website and call the Data API directly. This
-- refuses them there too.
--
-- ONE condition, defined once, used by every enforcement point:
--   * PostgREST pre-request hook — every table AND every SECURITY DEFINER
--     function reached through the Data API. RLS alone cannot cover definers.
--   * messages SELECT — Realtime evaluates RLS, not the pre-request hook.
--   * storage.objects INSERT — Storage does not run the hook either.
--
-- DEPLOY ORDER: the website gate ships first. Without /two-factor, a
-- two-factor member is refused every API call with no screen to pass.
--
-- ROLLBACK:
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

create or replace function public.session_owes_second_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (
       select 1
         from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
     );
$fn$;

-- Policies call it as the member; `authenticated` cannot read auth.mfa_factors,
-- which is why the helper is a definer.
revoke execute on function public.session_owes_second_factor() from public, anon;
grant execute on function public.session_owes_second_factor() to authenticated, service_role;

create or replace function public.enforce_second_factor()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if auth.role() is distinct from 'authenticated' then
    return;
  end if;

  -- The ways back in stay open while the code is owed: spending a recovery
  -- code, and the lockout reset LoginForm runs right after a good password.
  if current_setting('request.path', true) in (
    '/rpc/consume_mfa_recovery_code',
    '/rpc/clear_login_failures'
  ) then
    return;
  end if;

  if public.session_owes_second_factor() then
    raise sqlstate 'PT403'
      using message = 'second_factor_required',
            hint = 'Enter the code from your authenticator app to continue.';
  end if;
end;
$fn$;

-- PostgREST runs the hook as the REQUEST role on every request. A missing grant
-- here is not a two-factor bug — it is every Data API call failing.
revoke execute on function public.enforce_second_factor() from public;
grant execute on function public.enforce_second_factor() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.enforce_second_factor';
notify pgrst, 'reload config';

-- Restrictive, so each narrows the existing permissive policies instead of
-- adding another way in.
drop policy if exists "second factor gate on message read" on public.messages;
create policy "second factor gate on message read" on public.messages
as restrictive for select to authenticated
using (not (select public.session_owes_second_factor()));

drop policy if exists "second factor gate on uploads" on storage.objects;
create policy "second factor gate on uploads" on storage.objects
as restrictive for insert to authenticated
with check (not (select public.session_owes_second_factor()));
