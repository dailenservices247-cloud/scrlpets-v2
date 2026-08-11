-- Onboarding runs as the seller, but `upsert_payout_account` is service-role
-- only — deliberately, because the enabled flags are Stripe's assertion. So a
-- seller starting onboarding had no way to record the account id they had just
-- been issued, and an abandoned onboarding would orphan that account and mint a
-- fresh one on the next attempt.
--
-- This is the narrow version they may call: it records THEIR OWN account id with
-- every capability flag false, which is the truthful state until Stripe says
-- otherwise. It cannot grant anything.
--
-- INSERT-only by design. If a row already exists it does nothing rather than
-- overwriting — otherwise a seller who re-ran onboarding after being approved
-- would reset their own `payouts_enabled` to false and lock themselves out of
-- selling until the next account.updated arrived.

create or replace function public.record_new_payout_account(account_id text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  if account_id is null or btrim(account_id) = '' then raise exception 'account_required'; end if;

  insert into public.seller_payout_accounts
    (profile_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted)
  values (uid, btrim(account_id), false, false, false)
  on conflict (profile_id) do nothing;
end; $fn$;
revoke execute on function public.record_new_payout_account(text) from anon, public;
grant execute on function public.record_new_payout_account(text) to authenticated;
