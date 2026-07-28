-- R17 second half — services/providers marketplace.
--
-- `services` already existed as a name-only subject entity for post
-- attribution. It becomes the marketplace record rather than gaining a
-- parallel table, for the same reason products did not get one: a second
-- table is a second place to forget a rule.
--
-- TRUST DECISION (flagged to Dailen): a service does not transfer an animal,
-- so the animal-listing gate does not apply. But boarding, transport and
-- grooming DO take custody of someone's animal, and blocking the surface
-- until providers are verified would leave it empty forever. So providers are
-- listable while UNVERIFIED, and the surface shows each provider's REAL
-- verification state rather than implying the platform vetted them.

alter table public.services
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists price_cents integer,
  add column if not exists currency text not null default 'usd',
  add column if not exists area text,
  add column if not exists contact_note text,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz default now() not null;

do $$ begin
  alter table public.services add constraint services_category_check
    check (category is null or category = any (array[
      'grooming','training','boarding','transport','veterinary','other'
    ]));
exception when duplicate_object then null; end $$;

-- Price is optional — "contact for a quote" is normal in this trade — but a
-- stated price may not be negative.
do $$ begin
  alter table public.services add constraint services_price_nonnegative
    check (price_cents is null or price_cents >= 0);
exception when duplicate_object then null; end $$;

create index if not exists idx_services_active
  on public.services using btree (category, created_at desc)
  where active;

-- The owner may edit and retire their own service. `services` shipped with
-- insert + public-read only, so the update path is added here rather than
-- rewriting the existing policies.
create policy "owner updates services" on public.services
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "owner deletes services" on public.services
for delete to authenticated
using (owner_id = (select auth.uid()));

-- A suspended account cannot publish a service either. RESTRICTIVE so it ANDs
-- onto the existing insert policy instead of replacing it.
create policy "suspended cannot offer services" on public.services
as restrictive for insert to authenticated
with check (not public.is_suspended((select auth.uid())));
