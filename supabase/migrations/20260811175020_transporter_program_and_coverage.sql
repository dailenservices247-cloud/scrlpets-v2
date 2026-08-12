-- Step 1 of the transporter layer: how someone BECOMES a bookable transporter.
--
-- The money layer already treats a transporter as a real party — orders carry a
-- transporter_id, pickup creates their payout leg, and delivery is confirmed by
-- them. What did not exist was any way to be one: nothing distinguished an
-- approved transporter from a member who typed "transport" into a service.
--
-- Reuses `seller_programs` rather than building a second approval system. It
-- already has admin review, rejection reasons, and a guard that makes
-- self-approval impossible. A parallel queue would be a second place to audit and
-- a second place to get that guard wrong.
--
-- TWO GATES, NOT ONE. Approved AND able to receive payouts. An approved
-- transporter with no working Connect account would take custody of an animal
-- against money that can never reach them — the same reasoning that stops a
-- seller listing without a payout account.

alter table public.seller_programs drop constraint if exists seller_programs_type_check;
alter table public.seller_programs add constraint seller_programs_type_check
  check (program_type = any (array['kennel','business','rescue','usda','breed_club','transporter']));

-- ============================================================== COVERAGE
/**
 * Where a transporter will actually go.
 *
 * `services.area` is free text, so "do you cover my route" is unanswerable — and
 * a buyer picking a transporter at checkout has to be able to ask exactly that.
 *
 * US state codes, deliberately NOT a radius in miles or lat/long routing.
 * Neither the seller's nor the buyer's precise address is known at browse time,
 * so a mileage promise would be a number the platform cannot verify — the same
 * class of fabrication as legacy's AI-estimated delivery quote, which is
 * rejected in the plan for the same reason.
 */
create table if not exists public.transport_coverage (
  service_id uuid not null references public.services(id) on delete cascade,
  region_code text not null,
  constraint transport_coverage_pkey primary key (service_id, region_code),
  -- ponytail: a regex, not a table of 50 states. Promote it the first time a
  -- non-US region needs a different shape.
  constraint transport_coverage_region_format check (region_code ~ '^[A-Z]{2}$')
);

alter table public.transport_coverage enable row level security;

-- Public read: a buyer must be able to see who covers their route before they
-- have any relationship with that transporter.
create policy "read transport coverage" on public.transport_coverage
for select to anon, authenticated using (true);

create policy "provider writes own coverage" on public.transport_coverage
for all to authenticated
using (exists (select 1 from public.services s
                where s.id = transport_coverage.service_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.services s
                where s.id = transport_coverage.service_id and s.owner_id = (select auth.uid())));

create index if not exists idx_transport_coverage_region
  on public.transport_coverage (region_code);

-- ============================================================== THE GATE
/**
 * Bookable as a transporter: approved by a human AND able to receive money.
 *
 * Mirrors can_receive_payouts() — a boolean, never the underlying records, so a
 * checkout page can ask without learning anything about the provider's
 * paperwork.
 */
create or replace function public.can_transport(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.seller_programs p
     where p.profile_id = target_profile
       and p.program_type = 'transporter'
       and p.status = 'approved'
  ) and public.can_receive_payouts(target_profile);
$fn$;
revoke execute on function public.can_transport(uuid) from public;
grant execute on function public.can_transport(uuid) to anon, authenticated;

/**
 * Approved transporters who cover BOTH ends of a route.
 *
 * Both ends, not either: a transporter who serves the pickup state but not the
 * delivery state cannot complete the journey, and offering them at checkout
 * would be offering a booking that has to be cancelled.
 */
create or replace function public.transporters_for_route(from_region text, to_region text)
returns table (
  service_id uuid,
  provider_id uuid,
  provider_username text,
  service_name text,
  price_cents integer,
  contact_note text
)
language sql stable security definer set search_path = public as $fn$
  select s.id, s.owner_id, pr.username, s.name, s.price_cents, s.contact_note
    from public.services s
    join public.profiles pr on pr.id = s.owner_id
   where s.category = 'transport'
     and s.active
     and public.can_transport(s.owner_id)
     and exists (select 1 from public.transport_coverage c
                  where c.service_id = s.id and c.region_code = upper(btrim(from_region)))
     and exists (select 1 from public.transport_coverage c
                  where c.service_id = s.id and c.region_code = upper(btrim(to_region)))
   order by s.price_cents asc nulls last;
$fn$;
revoke execute on function public.transporters_for_route(text, text) from public;
grant execute on function public.transporters_for_route(text, text) to anon, authenticated;
