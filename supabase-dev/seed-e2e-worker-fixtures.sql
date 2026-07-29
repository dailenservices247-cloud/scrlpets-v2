-- E2E per-worker fixture accounts — DEV PROJECT ONLY (irpayabloogarxwtjmrf).
--
-- Why these exist: the whole Playwright suite used to sign in as the same two
-- or three accounts, so any worker parallelism collided on Supabase auth at
-- /login (reverted 2026-07-28). Each worker now owns a full account set,
-- selected in tests/e2e/fixtures.ts by TEST_PARALLEL_INDEX (the stable slot,
-- never the restart-incrementing TEST_WORKER_INDEX). Slot 0 keeps the
-- original accounts, so this file seeds workers 1..2 only. Add another block
-- of three when raising playwright.config.ts `workers` above 3.
--
-- Run with __E2E_PASSWORD__ substituted from .env.local (never commit the
-- literal). Idempotent: rerunning changes nothing. NEVER run against prod —
-- prod carries no fixture accounts by design (A10).
--
-- The auth.users/auth.identities column set mirrors what GoTrue itself writes;
-- the empty-string token columns matter (GoTrue scans them as text and chokes
-- on NULL). The profile row appears via the on_auth_user_created trigger; the
-- explicit username UPDATE pins the deterministic names the specs import.

do $$
declare
  fixture record;
begin
  for fixture in
    select * from (values
      ('00000000-0000-0000-0000-000000000011'::uuid, 'scrlpets-e2e-w1@scrlpets.com',       'e2e_seller_w1', true),
      ('00000000-0000-0000-0000-000000000012'::uuid, 'scrlpets-rbac-e2e-w1@scrlpets.com',  'e2e_member_w1', false),
      ('00000000-0000-0000-0000-000000000013'::uuid, 'scrlpets-rbac-third-w1@scrlpets.com','e2e_third_w1',  false),
      ('00000000-0000-0000-0000-000000000021'::uuid, 'scrlpets-e2e-w2@scrlpets.com',       'e2e_seller_w2', true),
      ('00000000-0000-0000-0000-000000000022'::uuid, 'scrlpets-rbac-e2e-w2@scrlpets.com',  'e2e_member_w2', false),
      ('00000000-0000-0000-0000-000000000023'::uuid, 'scrlpets-rbac-third-w2@scrlpets.com','e2e_third_w2',  false)
    ) as t(id, email, username, verified)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', fixture.id, 'authenticated',
      'authenticated', fixture.email,
      extensions.crypt('__E2E_PASSWORD__', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), fixture.id, fixture.id::text,
      jsonb_build_object('sub', fixture.id::text, 'email', fixture.email, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do nothing;

    update public.profiles
       set username = fixture.username, display_name = fixture.username
     where id = fixture.id and username <> fixture.username;

    -- Sellers mirror worker 0's ...0001: identity-verified so the animal
    -- listing gate passes legitimately. Members and thirds stay unverified —
    -- the gate specs depend on that.
    if fixture.verified then
      insert into public.identity_verifications
        (profile_id, provider, provider_ref, status, submitted_at, decided_at)
      values
        (fixture.id, 'stripe_identity', 'e2e-fixture', 'verified', now(), now())
      on conflict (profile_id) do nothing;

      -- Content parity with slot 0's breeder_jane: one owned animal, because
      -- marketplace-inquiry reads the seller's EXISTING creature instead of
      -- creating one (it exercises the attest → list → inquire path on
      -- standing data).
      insert into public.creatures (owner_id, name, slug, species)
      select fixture.id, 'Scout ' || fixture.username, 'e2e-scout-' || fixture.username, 'Dog'
      where not exists (
        select 1 from public.creatures where slug = 'e2e-scout-' || fixture.username
      );
    end if;
  end loop;
end $$;
