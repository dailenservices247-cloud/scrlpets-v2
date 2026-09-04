# Service Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can propose a time for a listed service, pay into escrow, and the provider can accept, complete, or ghost — with the money resolving correctly in all three cases through the existing order machine.

**Architecture:** A booking is a row in `orders`, not a new table. The spec's reasoning holds but its join did not exist: services live in `public.services`, while `orders.listing_id` references `public.listings`. This plan adds `orders.service_id` (exclusive with `listing_id`), the scheduled start/end, and one acceptance timestamp. Every fee, refund, dispute and payout path is the one already written. Three time-triggers run in `runScheduledJobs`; two are new and refund, one already exists and releases.

**Tech Stack:** Postgres (Supabase) SECURITY DEFINER functions + RLS, Next.js 16 App Router server actions, Vitest, Playwright, `supabase/probes/*.probe.sql` executed by `./run-probes.sh`.

---

## Spec reconciliation — read before Task 1

The approved spec (`docs/superpowers/specs/2026-09-02-service-bookings-design.md`) is correct in intent and wrong in three specifics. Do not "fix" the code to match the spec's wording; the corrections below are the design.

| Spec says | Schema reality | This plan |
|---|---|---|
| "`orders` does not filter on `listing_kind`, so a service listing takes an order exactly as an animal does" | Services are `public.services`, not `public.listings`. `orders.listing_id` references `listings(id)`. There is no path from an order to a service. | Add `orders.service_id uuid references services(id)`, with a check that exactly one of `listing_id` / `service_id` is non-null. |
| "the inspection window the listing already carries (`listings.inspection_hours`, 24–336, default 24)" | `inspection_hours` is a column on **`orders`** (added in `20260804123846_money_state_machine.sql:46`, `check >= 24`). `listings` carries the seller's chosen value and `create_order` copies it. `services` has no such column. | Add nullable `services.inspection_hours` with the same `>= 24` check. `propose_booking` copies it exactly as `create_order` does: `greatest(coalesce(svc.inspection_hours, 24), 24)`. |
| Flow is `proposed → funds_held → …` | `orders_status_check` (latest: `20260810202456_order_payments_and_payouts.sql:27`) permits `draft, awaiting_payment, deposit_held, funds_held, dispatched, inspection, released, refunded, cancelled, disputed`. No `proposed`. | Extend the constraint with `'proposed'`. |

**Acceptance is not a status.** The spec wants acceptance to be "instant and one-sided" and money is already held either way, so the order's money status does not change when a provider accepts. Acceptance is `orders.booking_accepted_at timestamptz`. Adding an `accepted` money status would imply a money transition that does not happen.

**Completion is not a new column.** "Provider marks complete" is exactly what `accept_delivery` does for animals: set `status = 'inspection'` and `inspection_ends_at = now() + inspection_hours`. Reuse that shape.

**`proposed → funds_held` needs no new code, and `mark_funds_held` no longer exists.** It was dropped in `20260810202456_order_payments_and_payouts.sql:247` — *"it booked a status without booking the money."* The transition is `record_order_payment(order, kind, amount, payment_intent_id)`, which derives the status from money actually captured against `order_due_cents(order)`. That function reads the **order's own columns**, never the listing, so it moves a booking to `funds_held` unmodified. Task 6 asserts this rather than assuming it.

**An unpaid booking is `cancelled`, not `refunded` — this is a correctness fix, not a preference.** `refund_on_order_settled` (`20260812201729:53`) enqueues an `order_refunds` row on *any* transition into `refunded` where `order_buyer_refund_cents > 0`, and that sum is non-zero for a declined proposal because it includes the unkept buyer fee. But `pending_refunds()` **inner joins** the captured-payments CTE, so a refund against an order with no captured payment is never returned — the row sits `pending` forever. Given `payments_enabled` is FALSE, *every* decline and *every* timer sweep would produce one of these.

So all three unwind paths branch on `public.order_captured_cents(order)`:

- **captured = 0** → `status = 'cancelled'`, no refund columns written, nothing enqueued. There is no money to give back.
- **captured > 0** → `status = 'refunded'` plus the refund columns, exactly as `settle_order` writes them.

Both branches are asserted. A plan that wrote `refunded` unconditionally would pass every probe and quietly accumulate dead queue rows.

**The proposal-expiry deadline is a guess, recorded as one.** The spec gives 24h for the no-completion grace but no number for proposal expiry. This plan uses **`least(created_at + 72 hours, service_start_at)`**. The second clause matters: a booking proposed for tomorrow morning must not sit unanswered for 72 hours. Real bookings correct both numbers.

**Why the two new cron functions are NOT `payments_enabled`-guarded.** `release_expired_inspections()` deliberately carries no flag guard — `cron.ts:63` states that an inspection window elapsing "is a fact about time, not about Stripe." A scheduled end passing is the same kind of fact. These functions only move `status` and write `refund_*` columns; the Stripe call happens downstream in `runPendingRefunds`, which is where the flag belongs. The user-facing `propose_booking` **is** guarded and refuses with `payments_disabled` — that refusal is the probe's assertion, per the spec.

---

## File Structure

**Create:**
- `supabase/migrations/20260904000000_service_bookings.sql` — all schema + all five definers. One migration because the definers are meaningless without the columns, and a half-applied pair is worse than either.
- `supabase/probes/service_bookings.probe.sql` — proposal, accept, decline, complete, and the flag refusal.
- `supabase/probes/service_booking_timers.probe.sql` — the three time-triggers, each proving the other two do not fire.
- `supabase/probes/service_order_guards.probe.sql` — existing order guards re-run against a service order (the spec names this risk explicitly).
- `src/lib/bookings/actions.ts` — server actions wrapping the definers.
- `src/lib/bookings/queries.ts` — booking reads for the provider and customer views.
- `src/lib/bookings/time.ts` — pure start/end validation, unit-testable without a database.
- `src/lib/bookings/time.test.ts`
- `src/components/services/BookingProposeForm.tsx`
- `src/components/services/BookingActions.tsx` — provider accept / decline / mark complete.
- `e2e/service-booking.spec.ts`

**Modify:**
- `src/lib/payments/cron.ts:19-26` (result type), `:78-84` (add two jobs)
- `src/lib/payments/cron.test.ts` — if absent, create it in Task 7
- `src/components/services/ServiceContactButton.tsx` — sits beside the new propose form; unchanged behaviour
- `messages/en.json`, `messages/es.json` — booking strings

**Do not touch:** `settle_order`, `create_order`, `release_expired_inspections`, `runPendingRefunds`, `runPendingPayouts`. If a task seems to require editing one of these, stop and re-read this plan — it does not.

---

### Task 1: Schema — the join the spec assumed existed

**Files:**
- Create: `supabase/migrations/20260904000000_service_bookings.sql`

- [ ] **Step 1: Write the migration's schema section**

Create `supabase/migrations/20260904000000_service_bookings.sql`:

```sql
-- Service bookings. A booking IS an order: same table, same state machine, same
-- fee model, same refund path, same admin dispute queue.
--
-- The design spec assumed a service was a listing and that `orders` therefore
-- already reached one. It is not: services are `public.services`, and
-- `orders.listing_id` references `public.listings`. This supplies the missing
-- join rather than converting services into listings, which would rewrite the
-- services marketplace to gain nothing the spec asked for.

alter table public.orders
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists service_start_at timestamptz,
  add column if not exists service_end_at timestamptz,
  add column if not exists booking_accepted_at timestamptz;

-- Exactly one subject. An order against both a listing and a service has two
-- sellers, two prices and two fee bases; an order against neither cannot be
-- settled at all. `on delete set null` above means a deleted subject leaves the
-- order intact and readable, so this is checked as "not both", not "exactly one".
alter table public.orders drop constraint if exists orders_subject_exclusive;
alter table public.orders add constraint orders_subject_exclusive
  check (not (listing_id is not null and service_id is not null));

-- A booking without a window has nothing for the auto-cancel guard to measure
-- from, and the guard is what stops a ghosting provider holding money forever.
alter table public.orders drop constraint if exists orders_booking_window;
alter table public.orders add constraint orders_booking_window
  check (
    service_id is null
    or (service_start_at is not null
        and service_end_at is not null
        and service_end_at > service_start_at)
  );

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status = any (array[
    'draft','proposed','awaiting_payment','deposit_held','funds_held','dispatched',
    'inspection','released','refunded','cancelled','disputed'
  ])
);

-- The window a provider chooses, mirroring `listings.inspection_hours`. Nullable
-- because every service published before today has none, and the definer falls
-- back to the same 24 that `create_order` does.
alter table public.services
  add column if not exists inspection_hours integer;
alter table public.services drop constraint if exists services_inspection_hours_check;
alter table public.services add constraint services_inspection_hours_check
  check (inspection_hours is null or (inspection_hours >= 24 and inspection_hours <= 336));

-- The two timer jobs scan on these. Partial, because only bookings qualify.
create index if not exists idx_orders_booking_unaccepted
  on public.orders (service_start_at)
  where service_id is not null and booking_accepted_at is null;

create index if not exists idx_orders_booking_uncompleted
  on public.orders (service_end_at)
  where service_id is not null;
```

- [ ] **Step 2: Apply it and verify the constraints actually bite**

Apply with the Supabase MCP `apply_migration`, or:

```bash
npx supabase db push
```

**Gotcha:** the MCP's `apply_migration` stamps its own UTC version, which will not match the local filename. If you apply via MCP, rename the local file to the version the MCP reports, or `db push` will re-run it.

Verify against dev by running this query (Supabase Management API or SQL editor):

```sql
-- Expect: three rows, one per new constraint.
select conname from pg_constraint
where conrelid = 'public.orders'::regclass
  and conname in ('orders_subject_exclusive','orders_booking_window','orders_status_check')
order by conname;
```

Expected output: `orders_booking_window`, `orders_status_check`, `orders_subject_exclusive`.

- [ ] **Step 3: Prove the exclusivity constraint rejects a double-subject order**

Run:

```sql
begin;
do $$
declare a uuid; b uuid; l uuid; s uuid;
begin
  perform set_config('role','postgres',true);
  select id into a from public.profiles limit 1;
  select id into b from public.profiles where id <> a limit 1;
  insert into public.listings (seller_id,title,price_cents,availability)
  values (a,'PROBE excl',1000,'available') returning id into l;
  insert into public.services (owner_id,name,category,price_cents,active)
  values (a,'PROBE excl svc','grooming',1000,true) returning id into s;
  begin
    insert into public.orders (buyer_id,seller_id,listing_id,service_id,amount_cents,
                               service_start_at,service_end_at)
    values (b,a,l,s,1000,now(),now()+interval '1 hour');
    raise exception 'FAILED: both subjects were accepted';
  exception when check_violation then
    raise notice 'ok: both-subjects rejected';
  end;
end $$;
rollback;
```

Expected: `NOTICE: ok: both-subjects rejected`, and no `FAILED`.

**Note:** the Supabase Management API does not return `NOTICE` output. If you are running through it, replace the `raise notice` with a `select` into a temp table as the existing probes do — see Task 2 for that shape.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000000_service_bookings.sql
git commit -m "RED: service booking columns and constraints, no definers yet

orders.service_id supplies the join the spec assumed existed. Exclusivity,
window, and the 'proposed' status are constrained at the DB, and verified by
rejecting a double-subject insert."
```

---

### Task 2: `propose_booking()` — the customer proposes and pays

**Files:**
- Modify: `supabase/migrations/20260904000000_service_bookings.sql` (append)
- Create: `supabase/probes/service_bookings.probe.sql`

- [ ] **Step 1: Write the failing probe**

Create `supabase/probes/service_bookings.probe.sql`:

```sql
-- Service bookings: a booking is an order, and every gate that guards an animal
-- sale guards a grooming appointment too.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  provider uuid := '00000000-0000-0000-0000-000000000011';
  customer uuid := '00000000-0000-0000-0000-000000000001';
  svc uuid; ord uuid; got text; results text := '';
  t0 timestamptz := now() + interval '2 days';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  perform public.upsert_payout_account(provider,'acct_sb_provider',true,true,true);

  insert into public.services (owner_id,name,category,price_cents,active,inspection_hours)
  values (provider,'PROBE grooming','grooming',8000,true,48) returning id into svc;

  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);

  ------------------------------------------- 1. a proposal creates an order
  ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
  perform set_config('role','postgres',true);
  select status || '/' || amount_cents || '/' || inspection_hours || '/' ||
         coalesce(listing_id::text,'null') || '/' || service_id::text
    into got from public.orders where id = ord;
  if got <> 'proposed/8000/48/null/' || svc::text then
    raise exception 'PROBE FAILED: proposed booking is %', got;
  end if;
  results := results || E'1a a proposal creates a proposed order against the service, not a listing\n';

  ------------------------------------------- 2. fees are the ruled ones
  select buyer_fee_cents || '/' || seller_fee_cents into got
    from public.orders where id = ord;
  -- 8000 * 300bps = 240 buyer (under the $150 cap); 8000 * 500bps = 400 seller.
  if got <> '240/400' then raise exception 'PROBE FAILED: booking fees are %', got; end if;
  results := results || E'2a booking fees use the same buyer/seller bps as a sale\n';

  ------------------------------------------- 3. a provider cannot book themselves
  perform set_config('request.jwt.claims',
    json_build_object('sub',provider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
    raise exception 'PROBE FAILED: the provider booked their own service';
  exception when others then
    if sqlerrm <> 'cannot_book_own_service' then raise; end if;
    results := results || E'3a a provider cannot book their own service\n';
  end;

  ------------------------------------------- 4. the window must be real
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    ord := public.propose_booking(svc, t0 + interval '3 hours', t0);
    raise exception 'PROBE FAILED: an end before its start was accepted';
  exception when others then
    if sqlerrm <> 'invalid_window' then raise; end if;
    results := results || E'4a an end at or before the start is refused\n';
  end;

  begin
    ord := public.propose_booking(svc, now() - interval '1 hour', now() + interval '1 hour');
    raise exception 'PROBE FAILED: a start in the past was accepted';
  exception when others then
    if sqlerrm <> 'start_in_past' then raise; end if;
    results := results || E'4b a start in the past is refused\n';
  end;

  ------------------------------------------- 5. an inactive service is unbookable
  perform set_config('role','postgres',true);
  update public.services set active=false where id=svc;
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
    raise exception 'PROBE FAILED: an inactive service was booked';
  exception when others then
    if sqlerrm <> 'service_not_found' then raise; end if;
    results := results || E'5a an inactive service cannot be booked\n';
  end;
  perform set_config('role','postgres',true);
  update public.services set active=true where id=svc;

  ------------------------------------------- 6. the flag is the last word
  update public.platform_flags set enabled=false where key='payments_enabled';
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
    raise exception 'PROBE FAILED: a booking was taken with payments disabled';
  exception when others then
    if sqlerrm <> 'payments_disabled' then raise; end if;
    results := results || E'6a payments_enabled=false refuses a booking outright\n';
  end;

  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
./run-probes.sh 2>&1 | grep -A 3 service_bookings
```

Expected: FAIL, with a message containing `function public.propose_booking(uuid, timestamp with time zone, timestamp with time zone) does not exist`.

- [ ] **Step 3: Write `propose_booking`**

Append to `supabase/migrations/20260904000000_service_bookings.sql`:

```sql
-- Deliberately mirrors `create_order` gate for gate. Where it reads a listing,
-- this reads a service; every other check is the same check in the same order,
-- because a customer paying for boarding is owed what a buyer paying for a
-- puppy is owed.
--
-- The customer pays at proposal, not at acceptance: a provider holding a slot
-- against nothing is worse than a refund, and the refund path already exists.
create or replace function public.propose_booking(
  target_service uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  svc record;
  oid uuid;
  b_bps integer; s_bps integer; b_fee integer; s_fee integer;
begin
  if uid is null then raise exception 'auth_required'; end if;
  if not public.is_flag_enabled('payments_enabled') then raise exception 'payments_disabled'; end if;
  if public.is_suspended(uid) then raise exception 'account_suspended'; end if;

  select * into svc from public.services where id = target_service and active;
  if svc is null then raise exception 'service_not_found'; end if;
  if svc.owner_id = uid then raise exception 'cannot_book_own_service'; end if;
  if coalesce(svc.price_cents, 0) <= 0 then raise exception 'service_not_priced'; end if;

  -- Re-checked here and not inherited from whatever the service page believed.
  if not public.can_receive_payouts(svc.owner_id) then
    raise exception 'provider_cannot_receive_payouts';
  end if;

  if starts_at is null or ends_at is null then raise exception 'invalid_window'; end if;
  if ends_at <= starts_at then raise exception 'invalid_window'; end if;
  if starts_at <= now() then raise exception 'start_in_past'; end if;

  b_bps := public.buyer_fee_bps();
  s_bps := public.seller_fee_bps_for(svc.owner_id);
  b_fee := least(round(svc.price_cents * b_bps / 10000.0)::integer, public.buyer_fee_cap_cents());
  s_fee := round(svc.price_cents * s_bps / 10000.0)::integer;

  insert into public.orders (
    buyer_id, seller_id, service_id, title_snapshot, amount_cents, currency,
    buyer_fee_bps, seller_fee_bps, buyer_fee_cents, seller_fee_cents,
    inspection_hours, service_start_at, service_end_at, status
  )
  values (uid, svc.owner_id, svc.id, svc.name, svc.price_cents, 'usd',
          b_bps, s_bps, b_fee, s_fee,
          greatest(coalesce(svc.inspection_hours, 24), 24), starts_at, ends_at, 'proposed')
  returning id into oid;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (oid, uid, null, 'proposed',
          'booking proposed; buyer ' || b_bps || 'bps=' || b_fee ||
          ', seller ' || s_bps || 'bps=' || s_fee);

  return oid;
end $fn$;

revoke execute on function public.propose_booking(uuid, timestamptz, timestamptz) from anon, public;
grant execute on function public.propose_booking(uuid, timestamptz, timestamptz) to authenticated;
```

- [ ] **Step 4: Apply and run the probe to verify it passes**

```bash
npx supabase db push && ./run-probes.sh 2>&1 | grep -A 8 service_bookings
```

Expected: seven rows, `1a` through `6a`.

- [ ] **Step 5: Negative control — prove assertion 2 discriminates**

The fee assertion passes trivially if fees are simply copied from somewhere. Temporarily change `b_fee` in the migration to `0`, re-apply, and re-run.

Expected: `PROBE FAILED: booking fees are 0/400`. Restore the correct line and re-apply before committing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260904000000_service_bookings.sql supabase/probes/service_bookings.probe.sql
git commit -m "GREEN: propose_booking, gate for gate with create_order

Six assertions: order shape, ruled fees, self-booking, both window rules,
inactive service, and the payments_enabled refusal. Fee assertion negative-
controlled by zeroing b_fee (fails 0/400) before restoring."
```

---

### Task 3: Accept and decline

**Files:**
- Modify: `supabase/migrations/20260904000000_service_bookings.sql` (append)
- Modify: `supabase/probes/service_bookings.probe.sql`

- [ ] **Step 1: Add the failing assertions**

In `supabase/probes/service_bookings.probe.sql`, insert this block immediately before the `------- 6. the flag is the last word` section (acceptance must be probed while `payments_enabled` is still true):

```sql
  ------------------------------------------- 5b. only the provider accepts
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.propose_booking(svc, t0, t0 + interval '3 hours');

  begin
    perform public.accept_booking(ord);
    raise exception 'PROBE FAILED: the customer accepted their own proposal';
  exception when others then
    if sqlerrm <> 'not_permitted' then raise; end if;
    results := results || E'5b the customer cannot accept their own proposal\n';
  end;

  ------------------------------------------- 5c. the provider accepts
  perform set_config('request.jwt.claims',
    json_build_object('sub',provider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.accept_booking(ord);
  perform set_config('role','postgres',true);
  select status || '/' || (booking_accepted_at is not null)::text
    into got from public.orders where id = ord;
  if got <> 'proposed/true' then
    raise exception 'PROBE FAILED: accepted booking is %', got;
  end if;
  results := results || E'5c acceptance stamps the order and does NOT move the money status\n';

  ------------------------------------------- 5d. accepting twice is refused
  perform set_config('request.jwt.claims',
    json_build_object('sub',provider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.accept_booking(ord);
    raise exception 'PROBE FAILED: a booking was accepted twice';
  exception when others then
    if sqlerrm <> 'already_accepted' then raise; end if;
    results := results || E'5d a booking cannot be accepted twice\n';
  end;

  ------------------------------------------- 5e. declining refunds in full
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
  perform set_config('request.jwt.claims',
    json_build_object('sub',provider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.decline_booking(ord);
  perform set_config('role','postgres',true);
  -- Nothing was captured on this order, so there is nothing to refund: it
  -- CANCELS. Asserting `refunded` here would bake in the dead-queue-row bug.
  select status || '/' || settlement_branch || '/' ||
         coalesce(refund_price_cents::text,'null') into got
    from public.orders where id = ord;
  if got <> 'cancelled/booking_declined/null' then
    raise exception 'PROBE FAILED: declined unpaid booking settled as %', got;
  end if;
  select count(*)::text into got from public.order_refunds where order_id = ord;
  if got <> '0' then
    raise exception 'PROBE FAILED: an unpaid decline enqueued % refund rows', got;
  end if;
  results := results || E'5e declining an UNPAID booking cancels it and enqueues no refund\n';

  ------------------------------------------- 5e2. a PAID decline really refunds
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
  perform set_config('role','postgres',true);
  perform public.record_order_payment(ord, 'balance', 8240, 'pi_probe_decline');
  perform set_config('request.jwt.claims',
    json_build_object('sub',provider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.decline_booking(ord);
  perform set_config('role','postgres',true);
  select status || '/' || refund_price_cents || '/' ||
         settled_buyer_fee_cents || '/' || settled_seller_fee_cents
    into got from public.orders where id = ord;
  if got <> 'refunded/8000/0/0' then
    raise exception 'PROBE FAILED: declined PAID booking settled as %', got;
  end if;
  select count(*)::text into got from public.order_refunds where order_id = ord;
  if got <> '1' then
    raise exception 'PROBE FAILED: a paid decline enqueued % refund rows, expected 1', got;
  end if;
  results := results || E'5e2 declining a PAID booking refunds in full, keeps no fee, and enqueues once\n';
```

- [ ] **Step 2: Run to verify it fails**

```bash
./run-probes.sh 2>&1 | grep -A 8 service_bookings
```

Expected: FAIL with `function public.accept_booking(uuid) does not exist`.

- [ ] **Step 3: Write both definers**

Append to `supabase/migrations/20260904000000_service_bookings.sql`:

```sql
-- Acceptance is one-sided and instant, and moves no money — the funds are
-- already held. It is a timestamp, not a status, because a status implies a
-- money transition that does not happen here.
create or replace function public.accept_booking(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.service_id is null then raise exception 'not_a_booking'; end if;
  if uid <> o.seller_id then raise exception 'not_permitted'; end if;
  if o.status not in ('proposed','funds_held') then raise exception 'order_closed'; end if;
  if o.booking_accepted_at is not null then raise exception 'already_accepted'; end if;

  update public.orders set booking_accepted_at = now(), updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, o.status, 'booking accepted by provider');
end $fn$;

revoke execute on function public.accept_booking(uuid) from anon, public;
grant execute on function public.accept_booking(uuid) to authenticated;

-- Declining gives back everything and keeps no fee. It is a separate function
-- because `settle_order`'s branches all describe an animal sale, and a provider
-- declining is not a dispute needing an admin.
--
-- CANCELLED when nothing was captured, REFUNDED when something was. Writing
-- `refunded` unconditionally would fire `refund_on_order_settled`, which
-- enqueues on any non-zero `order_buyer_refund_cents` — and that sum is non-zero
-- here even with no payment, because it includes the unkept buyer fee.
-- `pending_refunds()` inner joins captured payments, so that row would never be
-- returned and would sit pending forever.
create or replace function public.decline_booking(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
  captured integer;
  final_status text;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.service_id is null then raise exception 'not_a_booking'; end if;
  if uid <> o.seller_id then raise exception 'not_permitted'; end if;
  if o.status in ('released','refunded','cancelled') then raise exception 'already_settled'; end if;
  if o.booking_accepted_at is not null then raise exception 'already_accepted'; end if;

  captured := public.order_captured_cents(target_order);
  final_status := case when captured > 0 then 'refunded' else 'cancelled' end;

  update public.orders set
    status = final_status,
    settlement_branch = 'booking_declined',
    refund_price_cents = case when captured > 0 then o.amount_cents else null end,
    refund_deposit_cents = case when captured > 0 then 0 else null end,
    refund_transport_cents = case when captured > 0 then 0 else null end,
    settled_buyer_fee_cents = case when captured > 0 then 0 else null end,
    settled_seller_fee_cents = case when captured > 0 then 0 else null end,
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, final_status,
          'booking declined by provider; captured=' || captured);
end $fn$;

revoke execute on function public.decline_booking(uuid) from anon, public;
grant execute on function public.decline_booking(uuid) to authenticated;
```

- [ ] **Step 4: Apply and run to verify it passes**

```bash
npx supabase db push && ./run-probes.sh 2>&1 | grep -A 14 service_bookings
```

Expected: twelve rows, `1a` through `6a` including `5b`–`5e2`.

- [ ] **Step 5: Negative control — prove `5c` discriminates**

Assertion `5c` claims acceptance does not move the money status. That passes vacuously if acceptance does nothing at all. Temporarily remove the `booking_accepted_at = now()` assignment from `accept_booking`, re-apply, and re-run.

Expected: `PROBE FAILED: accepted booking is proposed/false`. Restore and re-apply before committing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260904000000_service_bookings.sql supabase/probes/service_bookings.probe.sql
git commit -m "GREEN: accept_booking and decline_booking

Acceptance is a timestamp, not a status — the money is already held, so no
money transition happens.

Decline branches on order_captured_cents: cancelled when nothing was captured,
refunded when something was. Writing refunded unconditionally fires
refund_on_order_settled, whose enqueue condition is non-zero even with no
payment (it counts the unkept buyer fee), while pending_refunds inner joins
captured payments — so the row would sit pending forever. Both branches are
asserted, including the refund-row COUNT on each side.

5c negative-controlled by removing the timestamp write (fails proposed/false)."
```

---

### Task 4: `mark_booking_complete()` — the provider's claim opens the window

**Files:**
- Modify: `supabase/migrations/20260904000000_service_bookings.sql` (append)
- Modify: `supabase/probes/service_bookings.probe.sql`

- [ ] **Step 1: Add the failing assertions**

Insert immediately after the `5e` block:

```sql
  ------------------------------------------- 5f. completion opens the window
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
  perform set_config('role','postgres',true);
  update public.orders set status='funds_held' where id=ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',provider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.accept_booking(ord);
  perform public.mark_booking_complete(ord);
  perform set_config('role','postgres',true);
  select status || '/' ||
         (inspection_ends_at > now() + interval '47 hours')::text || '/' ||
         (inspection_ends_at < now() + interval '49 hours')::text
    into got from public.orders where id = ord;
  if got <> 'inspection/true/true' then
    raise exception 'PROBE FAILED: completed booking is %', got;
  end if;
  results := results || E'5f completion opens an inspection window of the service''s own 48 hours\n';

  ------------------------------------------- 5g. only the provider completes
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.propose_booking(svc, t0, t0 + interval '3 hours');
  perform set_config('role','postgres',true);
  update public.orders set status='funds_held' where id=ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.mark_booking_complete(ord);
    raise exception 'PROBE FAILED: the customer marked the job complete';
  exception when others then
    if sqlerrm <> 'not_permitted' then raise; end if;
    results := results || E'5g only the provider can mark the job complete\n';
  end;
```

- [ ] **Step 2: Run to verify it fails**

```bash
./run-probes.sh 2>&1 | grep -A 14 service_bookings
```

Expected: FAIL with `function public.mark_booking_complete(uuid) does not exist`.

- [ ] **Step 3: Write the definer**

Append to `supabase/migrations/20260904000000_service_bookings.sql`:

```sql
-- Grooming has no delivery moment and no handover code, so completion is the
-- provider's CLAIM, not proof. The inspection window is what makes that safe —
-- exactly as it does when an animal arrives and the buyer has hours to object.
--
-- Deliberately permitted when the customer never showed: the provider held the
-- slot, and the window is where the customer objects. The platform does not
-- adjudicate attendance up front; it gives the customer a window and an admin
-- a queue.
create or replace function public.mark_booking_complete(target_order uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  uid uuid := auth.uid();
  o record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into o from public.orders where id = target_order;
  if o is null then raise exception 'not_found'; end if;
  if o.service_id is null then raise exception 'not_a_booking'; end if;
  if uid <> o.seller_id then raise exception 'not_permitted'; end if;
  if o.status <> 'funds_held' then raise exception 'not_holding_funds'; end if;

  update public.orders set
    status = 'inspection',
    inspection_ends_at = now() + make_interval(hours => o.inspection_hours),
    updated_at = now()
  where id = target_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (target_order, uid, o.status, 'inspection',
          'provider marked the booking complete; ' || o.inspection_hours || 'h to object');
end $fn$;

revoke execute on function public.mark_booking_complete(uuid) from anon, public;
grant execute on function public.mark_booking_complete(uuid) to authenticated;
```

- [ ] **Step 4: Apply and run to verify it passes**

```bash
npx supabase db push && ./run-probes.sh 2>&1 | grep -A 14 service_bookings
```

Expected: fourteen rows, `1a` through `6a` including `5f` and `5g`.

- [ ] **Step 5: Negative control — prove `5f` reads the service's window, not the default**

The service in this probe sets `inspection_hours = 48`. If the definer used the hardcoded 24, the two boundary assertions would fail. Temporarily change `make_interval(hours => o.inspection_hours)` to `make_interval(hours => 24)`, re-apply, re-run.

Expected: `PROBE FAILED: completed booking is inspection/false/true`. Restore and re-apply.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260904000000_service_bookings.sql supabase/probes/service_bookings.probe.sql
git commit -m "GREEN: mark_booking_complete opens the inspection window

Completion is the provider's claim, not proof; the window makes it safe. The
window comes from the service's own inspection_hours — negative-controlled by
hardcoding 24 (fails inspection/false/true)."
```

---

### Task 5: The three time-triggers, each proving the other two do not fire

This is the task the spec singles out: *"THREE time-triggers now, and two of them are opposites… asserting only that the right one fired would pass while all three fired."*

**Files:**
- Modify: `supabase/migrations/20260904000000_service_bookings.sql` (append)
- Create: `supabase/probes/service_booking_timers.probe.sql`

- [ ] **Step 1: Write the failing probe**

Create `supabase/probes/service_booking_timers.probe.sql`:

```sql
-- The three time-triggers. Two refund, one releases, and a bug that fires the
-- wrong one either refunds a provider who did the work or pays one who never
-- showed. Every case asserts on ALL THREE orders, so a run that fired
-- everything fails here instead of passing.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  provider uuid := '00000000-0000-0000-0000-000000000011';
  customer uuid := '00000000-0000-0000-0000-000000000001';
  svc uuid;
  o_unaccepted uuid;   -- proposed, never accepted, deadline passed  -> refund
  o_uncompleted uuid;  -- accepted, end + grace passed, never done   -> refund
  o_inspecting uuid;   -- completed, window elapsed                  -> RELEASE
  o_animal uuid; lst uuid;  -- an ANIMAL sale, which no booking timer may touch
  got text; n integer; results text := '';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  perform public.upsert_payout_account(provider,'acct_sbt_provider',true,true,true);

  insert into public.services (owner_id,name,category,price_cents,active)
  values (provider,'PROBE timers','boarding',5000,true) returning id into svc;

  -- Built directly rather than through the definers: the definers refuse a start
  -- in the past, and every case here is by definition in the past.
  --
  -- The FIRST is left unpaid and the other two are paid in full, so this probe
  -- exercises both sides of the cancelled/refunded branch rather than only the
  -- one that happens to be reachable with payments disabled.
  insert into public.orders (buyer_id,seller_id,service_id,title_snapshot,amount_cents,
                             status,service_start_at,service_end_at,inspection_hours,
                             buyer_fee_bps,seller_fee_bps,buyer_fee_cents,seller_fee_cents)
  values (customer,provider,svc,'PROBE unaccepted',5000,'proposed',
          now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 24,
          300,500,150,250)
  returning id into o_unaccepted;

  insert into public.orders (buyer_id,seller_id,service_id,title_snapshot,amount_cents,
                             status,service_start_at,service_end_at,inspection_hours,
                             buyer_fee_bps,seller_fee_bps,buyer_fee_cents,seller_fee_cents,
                             booking_accepted_at)
  values (customer,provider,svc,'PROBE uncompleted',5000,'proposed',
          now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 24,
          300,500,150,250, now() - interval '6 days')
  returning id into o_uncompleted;
  -- Paying the exact amount due drives the status to funds_held on its own.
  perform public.record_order_payment(
    o_uncompleted, 'balance', public.order_due_cents(o_uncompleted), 'pi_probe_uncompleted');

  insert into public.orders (buyer_id,seller_id,service_id,title_snapshot,amount_cents,
                             status,service_start_at,service_end_at,inspection_hours,
                             buyer_fee_bps,seller_fee_bps,buyer_fee_cents,seller_fee_cents,
                             booking_accepted_at)
  values (customer,provider,svc,'PROBE inspecting',5000,'proposed',
          now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 24,
          300,500,150,250, now() - interval '6 days')
  returning id into o_inspecting;
  perform public.record_order_payment(
    o_inspecting, 'balance', public.order_due_cents(o_inspecting), 'pi_probe_inspecting');
  update public.orders set status='inspection', inspection_ends_at = now() - interval '1 hour'
  where id = o_inspecting;

  -- Assert the fixtures are actually in the states the cases below assume. A
  -- probe whose setup silently drifted asserts nothing about the timers.
  select (select status from public.orders where id=o_unaccepted) || '/' ||
         (select status from public.orders where id=o_uncompleted) || '/' ||
         (select status from public.orders where id=o_inspecting) into got;
  if got <> 'proposed/funds_held/inspection' then
    raise exception 'PROBE FAILED: fixtures start as %, expected proposed/funds_held/inspection', got;
  end if;

  ------------------------------------------- 1. expiry refunds ONLY the unaccepted
  select public.expire_unaccepted_bookings() into n;
  if n <> 1 then raise exception 'PROBE FAILED: expiry touched % orders, expected 1', n; end if;
  select (select status from public.orders where id=o_unaccepted) || '/' ||
         (select status from public.orders where id=o_uncompleted) || '/' ||
         (select status from public.orders where id=o_inspecting) into got;
  if got <> 'cancelled/funds_held/inspection' then
    raise exception 'PROBE FAILED: after expiry the three orders are %', got;
  end if;
  results := results || E'1a proposal expiry closes out the unaccepted booking\n';
  results := results || E'1b and does NOT touch the accepted-but-uncompleted booking\n';
  results := results || E'1c and does NOT touch the booking under inspection\n';

  -- Unpaid, so CANCELLED with no refund columns and nothing enqueued.
  select settlement_branch || '/' || coalesce(refund_price_cents::text,'null')
    into got from public.orders where id=o_unaccepted;
  if got <> 'booking_expired/null' then
    raise exception 'PROBE FAILED: expired UNPAID booking settled as %', got;
  end if;
  select count(*)::text into got from public.order_refunds where order_id=o_unaccepted;
  if got <> '0' then
    raise exception 'PROBE FAILED: an unpaid expiry enqueued % refund rows', got;
  end if;
  results := results || E'1d an expired UNPAID proposal cancels and enqueues no refund\n';

  ------------------------------------------- 2. no-completion refunds ONLY that one
  select public.cancel_uncompleted_bookings() into n;
  if n <> 1 then raise exception 'PROBE FAILED: no-completion touched % orders, expected 1', n; end if;
  select (select status from public.orders where id=o_unaccepted) || '/' ||
         (select status from public.orders where id=o_uncompleted) || '/' ||
         (select status from public.orders where id=o_inspecting) into got;
  if got <> 'cancelled/refunded/inspection' then
    raise exception 'PROBE FAILED: after no-completion the three orders are %', got;
  end if;
  results := results || E'2a a booking never completed after its end refunds the customer\n';
  results := results || E'2b and does NOT re-settle the already-closed expiry\n';
  results := results || E'2c and does NOT touch the booking under inspection\n';

  -- This one WAS paid, so it takes the refund branch: columns written and one
  -- queue row. This is the assertion that proves the branch is not simply
  -- always-cancel.
  select settlement_branch || '/' || refund_price_cents || '/' ||
         settled_buyer_fee_cents || '/' || settled_seller_fee_cents
    into got from public.orders where id=o_uncompleted;
  if got <> 'booking_not_completed/5000/0/0' then
    raise exception 'PROBE FAILED: uncompleted PAID booking settled as %', got;
  end if;
  select count(*)::text into got from public.order_refunds where order_id=o_uncompleted;
  if got <> '1' then
    raise exception 'PROBE FAILED: a paid no-completion enqueued % refund rows, expected 1', got;
  end if;
  results := results || E'2d a PAID no-completion refunds in full, keeps no fee, and enqueues once\n';
  results := results || E'2e the two branches are distinguishable after the fact by settlement_branch\n';

  ------------------------------------------- 3. inspection RELEASES, opposite direction
  select public.release_expired_inspections() into n;
  select (select status from public.orders where id=o_unaccepted) || '/' ||
         (select status from public.orders where id=o_uncompleted) || '/' ||
         (select status from public.orders where id=o_inspecting) into got;
  if got <> 'cancelled/refunded/released' then
    raise exception 'PROBE FAILED: after release the three orders are %', got;
  end if;
  results := results || E'3a an elapsed inspection window RELEASES to the provider\n';
  results := results || E'3b and the two closed-out bookings are not resurrected\n';

  ------------------------------------------- 4. a booking not yet due is untouched
  perform set_config('role','postgres',true);
  update public.orders set status='funds_held', settlement_branch=null,
         booking_accepted_at=null,
         service_start_at = now() + interval '2 days',
         service_end_at = now() + interval '2 days' + interval '2 hours',
         created_at = now()
  where id = o_unaccepted;
  select public.expire_unaccepted_bookings() into n;
  if n <> 0 then raise exception 'PROBE FAILED: expiry claimed % future bookings', n; end if;
  select public.cancel_uncompleted_bookings() into n;
  if n <> 0 then raise exception 'PROBE FAILED: no-completion claimed % future bookings', n; end if;
  results := results || E'4a a booking whose window has not arrived is left alone by both\n';

  ------------------------------------------- 5. an ANIMAL order is never booking-swept
  -- The timers scan `orders`, which is now shared. A missing `service_id is not
  -- null` clause would sweep animal sales into a booking refund, and nothing
  -- above would catch it — every fixture so far is a booking.
  perform set_config('role','postgres',true);
  insert into public.listings (seller_id,title,price_cents,availability)
  values (provider,'PROBE animal for timers',20000,'available') returning id into lst;
  insert into public.orders (buyer_id,seller_id,listing_id,title_snapshot,amount_cents,
                             status,inspection_hours,
                             buyer_fee_bps,seller_fee_bps,buyer_fee_cents,seller_fee_cents)
  values (customer,provider,lst,'PROBE animal',20000,'funds_held',24,300,500,600,1000)
  returning id into o_animal;

  select public.expire_unaccepted_bookings() into n;
  if n <> 0 then raise exception 'PROBE FAILED: expiry swept % animal orders', n; end if;
  select public.cancel_uncompleted_bookings() into n;
  if n <> 0 then raise exception 'PROBE FAILED: no-completion swept % animal orders', n; end if;
  select status into got from public.orders where id = o_animal;
  if got <> 'funds_held' then
    raise exception 'PROBE FAILED: an animal order was moved to % by a booking timer', got;
  end if;
  results := results || E'5a an ANIMAL order is invisible to both booking timers\n';

  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
```

- [ ] **Step 2: Run to verify it fails**

```bash
./run-probes.sh 2>&1 | grep -A 14 service_booking_timers
```

Expected: FAIL with `function public.expire_unaccepted_bookings() does not exist`.

- [ ] **Step 3: Write both cron definers**

Append to `supabase/migrations/20260904000000_service_bookings.sql`:

```sql
-- ============================================================ THE TWO TIMERS
-- Neither is `payments_enabled`-guarded, for the same reason
-- `release_expired_inspections` is not: a deadline passing is a fact about time,
-- not about Stripe. These move `status` and write the refund columns; the Stripe
-- call happens downstream in `runPendingRefunds`, which is where the flag lives.
--
-- Both are service-role only. Neither is reachable by a logged-in user.

-- A proposal the provider never answered. The deadline is the SOONER of 72 hours
-- and the booking's own start: a proposal for tomorrow morning must not sit
-- unanswered for three days. Both numbers are guesses and are recorded as such
-- in the plan; real bookings correct them.
create or replace function public.expire_unaccepted_bookings()
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  n integer := 0;
  r record;
  captured integer;
  final_status text;
begin
  for r in
    select id, amount_cents, status from public.orders
    where service_id is not null
      and booking_accepted_at is null
      and status in ('proposed','funds_held')
      and now() > least(created_at + interval '72 hours', service_start_at)
    for update
  loop
    -- Same cancelled/refunded branch as decline_booking, and for the same
    -- reason: an order with nothing captured has nothing to refund, and
    -- writing `refunded` would enqueue a row pending_refunds can never return.
    captured := public.order_captured_cents(r.id);
    final_status := case when captured > 0 then 'refunded' else 'cancelled' end;

    update public.orders set
      status = final_status,
      settlement_branch = 'booking_expired',
      refund_price_cents = case when captured > 0 then r.amount_cents else null end,
      refund_deposit_cents = case when captured > 0 then 0 else null end,
      refund_transport_cents = case when captured > 0 then 0 else null end,
      settled_buyer_fee_cents = case when captured > 0 then 0 else null end,
      settled_seller_fee_cents = case when captured > 0 then 0 else null end,
      updated_at = now()
    where id = r.id;

    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (r.id, null, r.status, final_status,
            'proposal expired unanswered; captured=' || captured);
    n := n + 1;
  end loop;
  return n;
end $fn$;

revoke execute on function public.expire_unaccepted_bookings() from anon, authenticated, public;

-- The provider ghosted: the appointment passed, nobody marked anything, and the
-- customer's money would otherwise be held indefinitely.
--
-- Grace period: 24 hours after the scheduled END. This number is a guess and is
-- recorded as one. Too short and a provider running late loses the payment; too
-- long and a customer is out of pocket for days.
--
-- Measured from the END and not the start: an open-ended appointment has nothing
-- to measure from, which is why `orders_booking_window` requires both.
create or replace function public.cancel_uncompleted_bookings()
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  n integer := 0;
  r record;
  captured integer;
  final_status text;
begin
  for r in
    select id, amount_cents, status from public.orders
    where service_id is not null
      and status = 'funds_held'
      and now() > service_end_at + interval '24 hours'
    for update
  loop
    captured := public.order_captured_cents(r.id);
    final_status := case when captured > 0 then 'refunded' else 'cancelled' end;

    update public.orders set
      status = final_status,
      settlement_branch = 'booking_not_completed',
      refund_price_cents = case when captured > 0 then r.amount_cents else null end,
      refund_deposit_cents = case when captured > 0 then 0 else null end,
      refund_transport_cents = case when captured > 0 then 0 else null end,
      settled_buyer_fee_cents = case when captured > 0 then 0 else null end,
      settled_seller_fee_cents = case when captured > 0 then 0 else null end,
      updated_at = now()
    where id = r.id;

    insert into public.order_events (order_id, actor_id, from_status, to_status, note)
    values (r.id, null, r.status, final_status,
            'booking never marked complete 24h after its end; captured=' || captured);
    n := n + 1;
  end loop;
  return n;
end $fn$;

revoke execute on function public.cancel_uncompleted_bookings() from anon, authenticated, public;
```

- [ ] **Step 4: Apply and run to verify it passes**

```bash
npx supabase db push && ./run-probes.sh 2>&1 | grep -A 16 service_booking_timers
```

Expected: thirteen rows, `1a` through `5a`.

- [ ] **Step 5: Negative control — prove the cross-assertions discriminate**

Assertions `1b`, `1c`, `2c` and `3b` are the whole point of this probe, and they pass trivially if the functions are correctly scoped for the wrong reason. Temporarily widen `expire_unaccepted_bookings` by deleting the `and booking_accepted_at is null` line, re-apply, re-run.

Expected: `PROBE FAILED: expiry touched 2 orders, expected 1`. Restore and re-apply.

Then temporarily delete `and status = 'funds_held'` from `cancel_uncompleted_bookings`, re-apply, re-run.

Expected: `PROBE FAILED: no-completion touched 3 orders, expected 1` — it would have swept the order under inspection *and* the already-cancelled one. Restore and re-apply.

Finally, temporarily delete `and service_id is not null` from `cancel_uncompleted_bookings`, re-apply, re-run. This is the control for case 5, and the most dangerous of the three: without it, animal sales are swept into booking refunds.

Expected: `PROBE FAILED: no-completion swept 1 animal orders`. Restore and re-apply before committing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260904000000_service_bookings.sql supabase/probes/service_booking_timers.probe.sql
git commit -m "GREEN: the two refund timers, cross-asserted against the release timer

Every case asserts on all three orders, so a run that fired everything fails
instead of passing. One fixture is left unpaid and two are paid in full, so both
sides of the cancelled/refunded branch are exercised rather than only the side
reachable with payments disabled. A fifth case pins that an ANIMAL order is
invisible to both timers — they scan a table that is now shared.

Three negative controls, each by widening a scope: dropping accepted-is-null
sweeps 2, dropping funds_held sweeps 3, dropping service-id-not-null sweeps the
animal sale."
```

---

### Task 6: Existing order guards, re-run against a service order

The spec: *"A booking is an order, so every existing order guard now applies to a shape it was not written for. The probes that pin the money machine must be re-run against a service order, not assumed to carry over."*

**Files:**
- Create: `supabase/probes/service_order_guards.probe.sql`

- [ ] **Step 1: Write the probe**

Create `supabase/probes/service_order_guards.probe.sql`:

```sql
-- Every guard the money machine already has, aimed at a booking. None of these
-- were written with a service order in mind; this is where we find out which
-- ones assumed a listing.
begin;
create temp table probe_out (msg text) on commit drop;
do $probe$
declare
  provider uuid := '00000000-0000-0000-0000-000000000011';
  customer uuid := '00000000-0000-0000-0000-000000000001';
  outsider uuid;
  svc uuid; ord uuid; got text; results text := '';
  t0 timestamptz := now() + interval '2 days';
begin
  perform set_config('role','postgres',true);
  update public.platform_flags set enabled=true where key='payments_enabled';
  perform public.upsert_payout_account(provider,'acct_sog_provider',true,true,true);
  select id into outsider from public.profiles where id not in (provider,customer) limit 1;

  insert into public.services (owner_id,name,category,price_cents,active)
  values (provider,'PROBE guards','training',9000,true) returning id into svc;

  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  ord := public.propose_booking(svc, t0, t0 + interval '2 hours');

  ------------------------------------------- 1. RLS: parties read, others cannot
  perform set_config('request.jwt.claims',
    json_build_object('sub',outsider,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select count(*)::text into got from public.orders where id = ord;
  if got <> '0' then raise exception 'PROBE FAILED: an outsider read the booking'; end if;
  results := results || E'1a a third party cannot read someone else''s booking\n';

  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select count(*)::text into got from public.orders where id = ord;
  if got <> '1' then raise exception 'PROBE FAILED: the customer cannot read their own booking'; end if;
  results := results || E'1b both parties read their own booking\n';

  ------------------------------------------- 2. no client write reaches orders
  begin
    update public.orders set status='released' where id = ord;
    if found then raise exception 'PROBE FAILED: a client UPDATE reached the booking'; end if;
    results := results || E'2a a client UPDATE on a booking changes nothing (no policy exists)\n';
  exception when insufficient_privilege then
    results := results || E'2a a client UPDATE on a booking is refused outright\n';
  end;

  ------------------------------------------- 2b. payment capture moves a booking
  -- This is the `proposed -> funds_held` step in the spec's flow, and nothing
  -- else in this feature implements it: `record_order_payment` derives the
  -- status from `order_due_cents`, which reads the ORDER's columns and never
  -- the listing. If that assumption is wrong, every booking stalls at proposed.
  perform set_config('role','postgres',true);
  perform public.record_order_payment(ord, 'balance', public.order_due_cents(ord), 'pi_probe_guards');
  select status || '/' || (handover_code is not null)::text into got
    from public.orders where id = ord;
  if got <> 'funds_held/true' then
    raise exception 'PROBE FAILED: a fully paid booking is %', got;
  end if;
  results := results || E'2b paying a booking in full moves it to funds_held, same as a sale\n';

  ------------------------------------------- 2c. a partial payment holds a deposit
  perform set_config('role','postgres',true);
  select count(*)::text into got from public.order_payments
  where order_id = ord and status = 'captured';
  if got <> '1' then
    raise exception 'PROBE FAILED: booking has % captured payments, expected 1', got;
  end if;
  results := results || E'2c the payment is recorded against the booking exactly once\n';

  ------------------------------------------- 3. the dispute path works on a booking
  perform set_config('role','postgres',true);
  update public.orders set status='inspection', inspection_ends_at = now() + interval '10 hours'
  where id = ord;
  perform set_config('request.jwt.claims',
    json_build_object('sub',customer,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  perform public.dispute_order(ord, 'PROBE: groomer never showed');
  perform set_config('role','postgres',true);
  select status into got from public.orders where id = ord;
  if got <> 'disputed' then raise exception 'PROBE FAILED: disputed booking is %', got; end if;
  results := results || E'3a a customer can dispute a booking inside the window\n';

  ------------------------------------------- 4. admin settlement works on a booking
  perform set_config('role','postgres',true);
  select count(*)::text into got from public.orders
  where id = ord and status = 'disputed';
  if got <> '1' then raise exception 'PROBE FAILED: booking left the dispute queue'; end if;
  results := results || E'4a a disputed booking sits in the same admin queue as a sale\n';

  ------------------------------------------- 5. release still refuses an open window
  perform set_config('role','postgres',true);
  update public.orders set status='inspection', inspection_ends_at = now() + interval '10 hours'
  where id = ord;
  perform public.release_expired_inspections();
  select status into got from public.orders where id = ord;
  if got <> 'inspection' then
    raise exception 'PROBE FAILED: an OPEN window released early, status is %', got;
  end if;
  results := results || E'5a a booking whose inspection window is still open does not release\n';

  update public.platform_flags set enabled=false where key='payments_enabled';
  insert into probe_out (msg) select unnest(string_to_array(btrim(results,E'\n'),E'\n'));
end $probe$;
select msg from probe_out;
rollback;
```

- [ ] **Step 2: Run it**

```bash
./run-probes.sh 2>&1 | grep -A 12 service_order_guards
```

Expected: eight rows, `1a` through `5a` including `2b` and `2c`.

**If any assertion fails, that is the finding, not a probe bug.** A guard that assumed `listing_id` is non-null is exactly what this task exists to surface. Fix the guard in a separate commit before continuing, and record which one it was.

- [ ] **Step 3: Commit**

```bash
git add supabase/probes/service_order_guards.probe.sql
git commit -m "GREEN: existing order guards hold against a service order

RLS reads, the absent client-write policy, payment capture, the dispute path,
the admin queue, and the open-window release refusal, all aimed at a booking
rather than a sale.

2b is the load-bearing one: proposed -> funds_held is implemented by nothing in
this feature, it is record_order_payment deriving status from order_due_cents.
That reads the order's own columns and never the listing — asserted here rather
than assumed, because if it were wrong every booking would stall at proposed."
```

---

### Task 7: Wire both timers into the scheduled tick

**Files:**
- Modify: `src/lib/payments/cron.ts`
- Create: `src/lib/payments/cron.test.ts` (if it does not already exist — check first)

- [ ] **Step 1: Write the failing test**

Check whether the file exists:

```bash
ls src/lib/payments/cron.test.ts 2>/dev/null || echo "absent — create it"
```

Create or extend `src/lib/payments/cron.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));
vi.mock("./payouts", () => ({
  runPendingRefunds: vi.fn(async () => ({ attempted: 0, refunded: 0, blocked: [] })),
  runPendingPayouts: vi.fn(async () => ({ attempted: 0, paid: 0, failed: [] })),
}));

import { runScheduledJobs } from "./cron";

describe("runScheduledJobs — booking timers", () => {
  beforeEach(() => {
    rpc.mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  it("runs both booking timers and reports their counts", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "release_expired_inspections") return { data: 1, error: null };
      if (name === "expire_unaccepted_bookings") return { data: 2, error: null };
      if (name === "cancel_uncompleted_bookings") return { data: 3, error: null };
      if (name === "overdue_shipments") return { data: [], error: null };
      return { data: null, error: null };
    });

    const result = await runScheduledJobs();

    expect(result.bookingsExpired).toBe(2);
    expect(result.bookingsUncompleted).toBe(3);
    expect(result.inspectionsReleased).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("isolates a failing booking timer from the release timer", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "expire_unaccepted_bookings") {
        return { data: null, error: { message: "boom" } };
      }
      if (name === "release_expired_inspections") return { data: 7, error: null };
      if (name === "cancel_uncompleted_bookings") return { data: 0, error: null };
      if (name === "overdue_shipments") return { data: [], error: null };
      return { data: null, error: null };
    });

    const result = await runScheduledJobs();

    // The release must still have happened. "One job threw, so nobody got paid"
    // is the failure this layer exists to prevent.
    expect(result.inspectionsReleased).toBe(7);
    expect(result.bookingsExpired).toBe(0);
    expect(result.errors).toEqual([{ job: "booking_expiry", reason: "boom" }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/lib/payments/cron.test.ts
```

Expected: FAIL — `expected undefined to be 2` on `result.bookingsExpired`.

- [ ] **Step 3: Wire the jobs in**

In `src/lib/payments/cron.ts`, extend the result type (currently lines 19–26):

```typescript
export type CronRunResult = {
  skipped?: "no_service_key";
  inspectionsReleased: number;
  bookingsExpired: number;
  bookingsUncompleted: number;
  overdueShipments: number;
  refunds: RefundRunResult;
  payouts: PayoutRunResult;
  errors: CronJobError[];
};
```

Add both to the `no_service_key` early return so the shape is total:

```typescript
    return {
      skipped: "no_service_key",
      inspectionsReleased: 0,
      bookingsExpired: 0,
      bookingsUncompleted: 0,
      overdueShipments: 0,
      refunds: EMPTY_REFUNDS,
      payouts: EMPTY_PAYOUTS,
      errors,
    };
```

Insert both jobs immediately after the inspections job (after line 69), before refunds — a refund the timer just queued should go out on the same tick, not wait for the next one:

```typescript
  // 1b. The two booking timers. Same "fact about time" reasoning as the
  //     inspection release above, and deliberately BEFORE the refund runner so
  //     a refund queued here goes out on this tick rather than the next.
  //
  //     They are opposites of the release: one pays the provider, these two pay
  //     the customer back. Each is isolated, because a bug in one must not stop
  //     the other from unwinding money that is owed.
  const bookingsExpired = await isolate("booking_expiry", errors, 0, async () => {
    const { data, error } = await supabase.rpc("expire_unaccepted_bookings");
    if (error) throw new Error(error.message);
    return (data as number | null) ?? 0;
  });

  const bookingsUncompleted = await isolate("booking_uncompleted", errors, 0, async () => {
    const { data, error } = await supabase.rpc("cancel_uncompleted_bookings");
    if (error) throw new Error(error.message);
    return (data as number | null) ?? 0;
  });
```

And extend the final return:

```typescript
  return {
    inspectionsReleased,
    bookingsExpired,
    bookingsUncompleted,
    overdueShipments,
    refunds,
    payouts,
    errors,
  };
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/lib/payments/cron.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Negative control — prove the isolation test discriminates**

The second test claims a thrown booking timer does not stop the release. Temporarily remove the `isolate(...)` wrapper from the `booking_expiry` job (call the rpc directly and let it throw).

Expected: the second test fails with an unhandled `boom` rather than passing. Restore the wrapper.

- [ ] **Step 6: Commit**

```bash
git add src/lib/payments/cron.ts src/lib/payments/cron.test.ts
git commit -m "GREEN: both booking timers run on the scheduled tick

Placed before the refund runner so a refund queued by a timer goes out on the
same tick. Isolation negative-controlled by unwrapping booking_expiry — the
release then dies with it."
```

---

### Task 8: Window validation as a pure function

The UI needs the same rules the definer enforces, and a rule that lives only in SQL cannot be shown to a customer before they submit. This mirrors the `validateUsername` pattern already in `src/lib/profiles/username.ts`.

**Files:**
- Create: `src/lib/bookings/time.ts`
- Create: `src/lib/bookings/time.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bookings/time.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validateBookingWindow } from "./time";

const NOW = new Date("2026-09-04T12:00:00Z");

describe("validateBookingWindow", () => {
  it("accepts a future window", () => {
    const r = validateBookingWindow("2026-09-06T09:00", "2026-09-06T11:00", NOW);
    expect(r).toEqual({
      ok: true,
      startsAt: new Date("2026-09-06T09:00").toISOString(),
      endsAt: new Date("2026-09-06T11:00").toISOString(),
    });
  });

  it("refuses an end at or before the start", () => {
    expect(validateBookingWindow("2026-09-06T11:00", "2026-09-06T09:00", NOW))
      .toEqual({ ok: false, reason: "invalid_window" });
    expect(validateBookingWindow("2026-09-06T09:00", "2026-09-06T09:00", NOW))
      .toEqual({ ok: false, reason: "invalid_window" });
  });

  it("refuses a start in the past", () => {
    expect(validateBookingWindow("2026-09-03T09:00", "2026-09-03T11:00", NOW))
      .toEqual({ ok: false, reason: "start_in_past" });
  });

  it("refuses unparseable input rather than sending NaN to the database", () => {
    expect(validateBookingWindow("", "2026-09-06T11:00", NOW))
      .toEqual({ ok: false, reason: "invalid_window" });
    expect(validateBookingWindow("not-a-date", "also-not", NOW))
      .toEqual({ ok: false, reason: "invalid_window" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/lib/bookings/time.test.ts
```

Expected: FAIL — `Failed to resolve import "./time"`.

- [ ] **Step 3: Write the module**

Create `src/lib/bookings/time.ts`:

```typescript
/**
 * The booking window rules, in one place.
 *
 * `propose_booking` enforces these again in the database — that is not
 * duplication. This copy exists so a customer sees "that time has passed"
 * before they submit, rather than a raw postgres error afterwards. The database
 * is still the authority; this is the courtesy.
 *
 * Reasons match the definer's exception strings exactly, so one message table
 * covers both.
 */
export type BookingWindowResult =
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; reason: "invalid_window" | "start_in_past" };

export function validateBookingWindow(
  start: string,
  end: string,
  now: Date = new Date(),
): BookingWindowResult {
  const startsAt = new Date(start);
  const endsAt = new Date(end);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { ok: false, reason: "invalid_window" };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, reason: "invalid_window" };
  }
  if (startsAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "start_in_past" };
  }
  return { ok: true, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/lib/bookings/time.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookings/time.ts src/lib/bookings/time.test.ts
git commit -m "GREEN: booking window validation as a pure function

Mirrors validateUsername: the DB stays the authority, this is what lets the UI
say 'that time has passed' before submitting. Reasons match the definer's
exception strings so one message table covers both."
```

---

### Task 9: Server actions

**Files:**
- Create: `src/lib/bookings/actions.ts`

- [ ] **Step 1: Write the module**

There is no unit test for this file: it is a thin translation layer over definers that the probes already pin, and mocking Supabase to assert "the rpc was called" tests the mock. The e2e in Task 11 covers the path end to end.

Create `src/lib/bookings/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateBookingWindow } from "./time";

export type BookingActionResult = { ok: true; id?: string } | { ok: false; error: string };

// The definers raise bare codes. Anything else is genuinely unexpected and says
// so, rather than being flattened into a friendly lie.
const KNOWN = [
  "auth_required",
  "payments_disabled",
  "account_suspended",
  "service_not_found",
  "cannot_book_own_service",
  "service_not_priced",
  "provider_cannot_receive_payouts",
  "invalid_window",
  "start_in_past",
  "not_found",
  "not_a_booking",
  "not_permitted",
  "order_closed",
  "already_accepted",
  "already_settled",
  "not_holding_funds",
];

function code(message: string): string {
  return KNOWN.find((k) => message.includes(k)) ?? message;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function proposeBooking(formData: FormData): Promise<BookingActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { ok: false, error: "service_not_found" };

  const window = validateBookingWindow(
    String(formData.get("start") ?? ""),
    String(formData.get("end") ?? ""),
  );
  if (!window.ok) return { ok: false, error: window.reason };

  const { data, error } = await supabase.rpc("propose_booking", {
    target_service: serviceId,
    starts_at: window.startsAt,
    ends_at: window.endsAt,
  });
  if (error) return { ok: false, error: code(error.message) };

  revalidatePath("/orders");
  return { ok: true, id: data as string };
}

export async function acceptBooking(orderId: string): Promise<BookingActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase.rpc("accept_booking", { target_order: orderId });
  if (error) return { ok: false, error: code(error.message) };
  revalidatePath("/orders");
  return { ok: true };
}

export async function declineBooking(orderId: string): Promise<BookingActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase.rpc("decline_booking", { target_order: orderId });
  if (error) return { ok: false, error: code(error.message) };
  revalidatePath("/orders");
  return { ok: true };
}

export async function markBookingComplete(orderId: string): Promise<BookingActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase.rpc("mark_booking_complete", { target_order: orderId });
  if (error) return { ok: false, error: code(error.message) };
  revalidatePath("/orders");
  return { ok: true };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Gotcha:** `"use server"` modules may export only async functions. `code()`, `KNOWN` and `requireUser` are module-private, which is fine — but do not add an exported constant or type-guard to this file. If you need one, put it in `src/lib/bookings/time.ts` or a new module. This has already broken a build in this repo once: it passes `tsc` and `vitest` and fails only at `next build`.

- [ ] **Step 3: Verify the whole build, not just types**

```bash
npx next build 2>&1 | tail -20
```

Expected: build completes. This step exists specifically because `tsc` does not catch the `"use server"` export rule.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bookings/actions.ts
git commit -m "feat: booking server actions over the definers

No unit test: mocking Supabase to assert the rpc was called tests the mock. The
probes pin the definers; the e2e covers the path. Verified with next build, not
just tsc — 'use server' export rules are invisible to tsc."
```

---

### Task 10: The UI — propose, accept, decline, complete

**Files:**
- Create: `src/components/services/BookingProposeForm.tsx`
- Create: `src/components/services/BookingActions.tsx`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Add the strings**

In `messages/en.json`, add a `booking` block at the top level (match the file's existing indentation and key ordering conventions — check a neighbouring block first):

```json
  "booking": {
    "propose": "Request this time",
    "start": "Starts",
    "end": "Ends",
    "pending": "Awaiting the provider",
    "accepted": "Confirmed",
    "accept": "Accept",
    "decline": "Decline",
    "complete": "Mark complete",
    "invalid_window": "The end has to be after the start.",
    "start_in_past": "That time has already passed.",
    "cannot_book_own_service": "This is your own service.",
    "provider_cannot_receive_payouts": "This provider can't take bookings yet.",
    "payments_disabled": "Bookings aren't open yet.",
    "service_not_priced": "This service doesn't have a price set.",
    "error": "That didn't go through. Try again."
  }
```

In `messages/es.json`, add the same keys with Spanish values:

```json
  "booking": {
    "propose": "Solicitar este horario",
    "start": "Comienza",
    "end": "Termina",
    "pending": "Esperando al proveedor",
    "accepted": "Confirmado",
    "accept": "Aceptar",
    "decline": "Rechazar",
    "complete": "Marcar como completado",
    "invalid_window": "El final tiene que ser después del comienzo.",
    "start_in_past": "Ese horario ya pasó.",
    "cannot_book_own_service": "Este es tu propio servicio.",
    "provider_cannot_receive_payouts": "Este proveedor aún no puede recibir reservas.",
    "payments_disabled": "Las reservas aún no están disponibles.",
    "service_not_priced": "Este servicio no tiene precio establecido.",
    "error": "No se pudo completar. Inténtalo de nuevo."
  }
```

- [ ] **Step 2: Write the propose form**

Create `src/components/services/BookingProposeForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { proposeBooking } from "@/lib/bookings/actions";
import { validateBookingWindow } from "@/lib/bookings/time";
import { Button } from "@/components/ui/button";

export function BookingProposeForm({ serviceId }: { serviceId: string }) {
  const t = useTranslations("booking");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // ponytail: no availability calendar. The provider advertises their hours in
  // the listing text and accepts or declines. A scheduling system is a larger
  // build than this whole feature — add it when providers ask.
  const local = validateBookingWindow(start, end);
  const ready = start !== "" && end !== "" && local.ok;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("serviceId", serviceId);
    fd.set("start", start);
    fd.set("end", end);
    const res = await proposeBooking(fd);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setDone(true);
  }

  if (done) return <p className="text-sm text-muted-foreground">{t("pending")}</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="booking-propose-form">
      <label className="text-sm text-muted-foreground" htmlFor="booking-start">
        {t("start")}
      </label>
      <input
        id="booking-start"
        type="datetime-local"
        className="rounded border border-input bg-transparent p-2"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        data-testid="booking-start"
      />
      <label className="text-sm text-muted-foreground" htmlFor="booking-end">
        {t("end")}
      </label>
      <input
        id="booking-end"
        type="datetime-local"
        className="rounded border border-input bg-transparent p-2"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        data-testid="booking-end"
      />
      {!local.ok && start !== "" && end !== "" && (
        <p className="text-destructive text-sm" data-testid="booking-local-error">
          {t(local.reason)}
        </p>
      )}
      {err && (
        <p className="text-destructive text-sm" data-testid="booking-error">
          {t.has(err) ? t(err) : t("error")}
        </p>
      )}
      <Button type="submit" disabled={busy || !ready} data-testid="booking-submit">
        {t("propose")}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the provider controls**

Create `src/components/services/BookingActions.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { acceptBooking, declineBooking, markBookingComplete } from "@/lib/bookings/actions";
import { Button } from "@/components/ui/button";

export function BookingActions({
  orderId,
  status,
  accepted,
}: {
  orderId: string;
  status: string;
  accepted: boolean;
}) {
  const t = useTranslations("booking");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setErr(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setErr(res.error ?? "error");
  }

  // Completion is only offered once the money is actually held. Offering it at
  // `proposed` would hand the provider a button that can only fail.
  const canComplete = accepted && status === "funds_held";

  return (
    <div className="flex flex-col gap-2" data-testid="booking-actions">
      {!accepted && (
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => run(() => acceptBooking(orderId))}
            data-testid="booking-accept"
          >
            {t("accept")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => run(() => declineBooking(orderId))}
            data-testid="booking-decline"
          >
            {t("decline")}
          </Button>
        </div>
      )}
      {accepted && !canComplete && (
        <p className="text-sm text-muted-foreground" data-testid="booking-accepted">
          {t("accepted")}
        </p>
      )}
      {canComplete && (
        <Button
          type="button"
          disabled={busy}
          onClick={() => run(() => markBookingComplete(orderId))}
          data-testid="booking-complete"
        >
          {t("complete")}
        </Button>
      )}
      {err && (
        <p className="text-destructive text-sm" data-testid="booking-actions-error">
          {t.has(err) ? t(err) : t("error")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount the form on the service page**

Find the service detail page:

```bash
grep -rln "ServiceContactButton" src/app/
```

In that page, render `<BookingProposeForm serviceId={service.id} />` immediately below the existing `<ServiceContactButton />`, but only when the service has a price — an unpriced service is "contact for a quote" and `propose_booking` would refuse it:

```tsx
{service.price_cents != null && service.price_cents > 0 && (
  <BookingProposeForm serviceId={service.id} />
)}
```

- [ ] **Step 5: Verify types and build**

```bash
npx tsc --noEmit && npx next build 2>&1 | tail -10
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/services/BookingProposeForm.tsx src/components/services/BookingActions.tsx messages/en.json messages/es.json src/app
git commit -m "feat: booking propose form and provider accept/decline/complete

No availability calendar — the provider advertises hours in their own words and
accepts or declines, per the spec's out-of-scope list. Complete is only offered
at funds_held, so the provider never gets a button that can only fail."
```

---

### Task 11: End-to-end, with the flag off

**Files:**
- Create: `e2e/service-booking.spec.ts`

`payments_enabled` is FALSE, so the happy path cannot complete. What the e2e proves is that the button reaches the database — the refusal IS the assertion, exactly as the spec says.

- [ ] **Step 1: Write the spec**

Read an existing e2e first to match this repo's auth fixture and helpers:

```bash
ls e2e/ && sed -n '1,30p' e2e/$(ls e2e | grep -v spec.ts-snapshots | head -1)
```

Create `e2e/service-booking.spec.ts`, adapting the auth helper to whatever the file above uses:

```typescript
import { test, expect } from "@playwright/test";

// payments_enabled is FALSE in every environment this runs against. The happy
// path therefore cannot complete, and that is the point: a refusal carrying
// `payments_disabled` proves the button reached the database rather than being
// swallowed in the client. A test that only asserted "no crash" would pass
// while the form was wired to nothing.

test.describe("service booking", () => {
  test("a priced service offers a booking form", async ({ page }) => {
    await page.goto("/services");
    const firstService = page.getByTestId("service-card").first();
    await firstService.click();
    await expect(page.getByTestId("booking-propose-form")).toBeVisible();
  });

  test("the submit button stays disabled until both times are set", async ({ page }) => {
    await page.goto("/services");
    await page.getByTestId("service-card").first().click();

    const submit = page.getByTestId("booking-submit");
    await expect(submit).toBeDisabled();

    await page.getByTestId("booking-start").fill("2027-01-05T09:00");
    // Still disabled: one half of a window is not a window.
    await expect(submit).toBeDisabled();

    await page.getByTestId("booking-end").fill("2027-01-05T11:00");
    await expect(submit).toBeEnabled();
  });

  test("an end before its start is refused in the client, before submitting", async ({ page }) => {
    await page.goto("/services");
    await page.getByTestId("service-card").first().click();

    await page.getByTestId("booking-start").fill("2027-01-05T11:00");
    await page.getByTestId("booking-end").fill("2027-01-05T09:00");

    await expect(page.getByTestId("booking-local-error")).toBeVisible();
    await expect(page.getByTestId("booking-submit")).toBeDisabled();
  });

  test("submitting a valid window reaches the database and is refused by the flag", async ({
    page,
  }) => {
    await page.goto("/services");
    await page.getByTestId("service-card").first().click();

    await page.getByTestId("booking-start").fill("2027-01-05T09:00");
    await page.getByTestId("booking-end").fill("2027-01-05T11:00");
    await page.getByTestId("booking-submit").click();

    // The refusal IS the assertion.
    await expect(page.getByTestId("booking-error")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

```bash
npx playwright test e2e/service-booking.spec.ts
```

Expected: 4 passed.

**If `service-card` is not the right testid,** find the real one rather than guessing:

```bash
grep -rn 'data-testid' src/components/services/ src/app/services/ 2>/dev/null | head
```

- [ ] **Step 3: Negative control — prove test 2 discriminates**

Test 2 claims the button stays disabled with only a start. That passes trivially if the button is disabled unconditionally. Temporarily change `disabled={busy || !ready}` to `disabled={busy}` in `BookingProposeForm.tsx` and re-run.

Expected: tests 2 and 3 fail (`expected disabled, got enabled`). Restore.

- [ ] **Step 4: Commit**

```bash
git add e2e/service-booking.spec.ts
git commit -m "GREEN: booking e2e, with payments_enabled false

The refusal is the assertion — it proves the form reached the database rather
than being swallowed client-side. Disabled-button test negative-controlled by
dropping the !ready guard (tests 2 and 3 then fail)."
```

---

### Task 12: Full verification and merge

- [ ] **Step 1: Run the full gate**

```bash
./ship-verify.sh
```

Expected: types, lint, unit, probes, e2e and the prod build all green. The probe count should have risen by the number of assertions added across Tasks 2–6 (fourteen + thirteen + eight = thirty-five new rows).

**Gotcha:** `ship-verify.sh` reads the working tree, not `HEAD`. An uncommitted file passes every gate and then is not in the commit. Confirm the tree is clean *before* reading the summary:

```bash
git status --short
```

Expected: empty. Never chain `git commit` behind a long verification run.

- [ ] **Step 2: Confirm the money flags are still off**

```sql
select key, enabled from public.platform_flags
where key in ('payments_enabled','subscriptions_enabled');
```

Expected: both `false`. Every probe sets `payments_enabled` true inside its own transaction and false again before rolling back, but a probe that raised early could leave it set in a non-rolled-back session. This is the check that catches it.

- [ ] **Step 3: Paste the SUMMARY block into the session log**

Per `AGENTS.md`, the run's SUMMARY block is the verification evidence. A ship is not complete without it.

- [ ] **Step 4: Update the parity ledger and handoff**

Per the Scrlpets legacy-intent gate, after verification update the private parity ledger and the cross-session handoff with the booking surface and its `last_reviewed_commit`.

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch`.

---

## What this deliberately does not build

Carried from the spec's out-of-scope list, restated so a later reader does not mistake absence for oversight:

- **Availability calendars.** The customer proposes; the provider accepts or declines. A provider publishing bookable slots is a scheduling system and a larger build than everything above.
- **Recurring bookings.**
- **Deposits / partial payment.** `orders.deposit_cents` exists and stays 0 for bookings. Adding a second money shape before the first has run once is guessing.
- **Partner companies.** A separate spec, and the affiliate primitive pointed the other way.

## The two guessed numbers

Both are recorded as guesses, and the first month of real bookings should correct them:

| Number | Value | Where |
|---|---|---|
| Completion grace after the scheduled end | 24 hours | `cancel_uncompleted_bookings` |
| Proposal expiry | `least(created_at + 72h, service_start_at)` | `expire_unaccepted_bookings` |
