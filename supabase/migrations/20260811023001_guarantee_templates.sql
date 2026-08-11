-- Guarantee templates, and a listing that says plainly what it promises.
--
-- The §4 branches have been adjudicating against "the seller's published
-- guarantee" since 2026-08-04. No seller could publish one. This is the document
-- those branches read.
--
-- LEGACY INTENT AUDIT
--   KEEP    a platform-curated template catalogue. Legacy had
--           `health_guarantee_templates`, and it is exactly what ruling 3 means
--           by giving sellers "a clear way not to be ambiguous".
--   KEEP    a per-listing guarantee attached to the listing.
--   REBUILD legacy's `listing_health_guarantees` had template_id AND custom_terms
--           both nullable and both settable. A row could promise NOTHING, or hold
--           two competing documents with no rule for which governs. The schema
--           MANUFACTURED the ambiguity that contra proferentem then punished the
--           seller for. Here `kind` names the governing document and a CHECK
--           makes the other columns impossible.
--   REJECT  legacy's AIContractGenerator assigned guarantee length BY
--           SUBSCRIPTION TIER — elite/pro got "1-year covering genetic
--           conditions", everyone else 30 days. The platform was writing legally
--           binding terms on the seller's behalf, scaled to what they paid
--           Scrlpets. Nothing here derives a promise from a plan.
--
-- EVERY TEMPLATE NAMES A REMEDY. That is the lesson from the hole closed in
-- `20260811022107`: a guarantee that says what is covered but not what happens
-- when it triggers is the ambiguity, and it is the shape that let a buyer keep
-- both the animal and the money. Coverage without a remedy is not a guarantee.
--
-- SPECIES-NEUTRAL BY CONSTRUCTION. Durations in days, no "litter", no "puppy",
-- nothing that assumes a mammal. This app is for every animal kept as a pet and
-- the templates a bird keeper sees must not be written for dogs.

create table if not exists public.guarantee_templates (
  key text not null,
  name text not null,
  coverage_description text not null,
  duration_days integer not null,
  remedy text not null,
  conditions text[] not null default '{}',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  constraint guarantee_templates_pkey primary key (key),
  constraint guarantee_templates_duration_positive check (duration_days > 0),
  -- The three remedies real contracts actually offer, matching settle_order's
  -- §4 branches one-for-one. A template cannot promise a remedy the settlement
  -- machinery cannot carry out.
  constraint guarantee_templates_remedy_check
    check (remedy = any (array['vet_costs', 'replacement', 'refund_on_return']))
);
alter table public.guarantee_templates enable row level security;
create policy "read guarantee templates" on public.guarantee_templates
for select to anon, authenticated using (true);

insert into public.guarantee_templates
  (key, name, coverage_description, duration_days, remedy, conditions, sort_order)
values
  ('live_arrival_72h', 'Live arrival — 72 hours',
   'The animal arrives alive and able to stand, feed and move normally. Report within 72 hours of delivery with dated photographs.',
   3, 'refund_on_return',
   array['Report within 72 hours of delivery', 'Dated photographs required',
         'Does not cover stress or refusal to feed that resolves within 72 hours'],
   1),
  ('health_14d_vet', 'Initial health — 14 days',
   'A licensed veterinarian finds an illness present at the time of sale. The seller reimburses the examination and treatment, up to the purchase price.',
   14, 'vet_costs',
   array['Examination by a licensed veterinarian within 14 days',
         'Written finding naming the animal by its registered identifier',
         'Does not cover conditions arising from the new keeper''s care'],
   2),
  ('congenital_1y_replace', 'Congenital condition — 1 year',
   'A licensed veterinarian diagnoses a congenital or hereditary condition that materially affects the animal''s quality of life. The seller offers a replacement animal.',
   365, 'replacement',
   array['Written veterinary diagnosis', 'Condition must be congenital or hereditary',
         'Replacement offered when the seller next has a suitable animal available'],
   3),
  ('congenital_1y_refund', 'Congenital condition — 1 year, refund on return',
   'A licensed veterinarian diagnoses a congenital or hereditary condition that materially affects the animal''s quality of life. The purchase price is refunded when the animal is returned to the seller.',
   365, 'refund_on_return',
   array['Written veterinary diagnosis', 'Condition must be congenital or hereditary',
         'The animal must be returned to the seller before the refund is made'],
   4)
on conflict (key) do update set
  name = excluded.name,
  coverage_description = excluded.coverage_description,
  duration_days = excluded.duration_days,
  remedy = excluded.remedy,
  conditions = excluded.conditions,
  sort_order = excluded.sort_order;

-- ==================================================== THE LISTING'S PROMISE
create table if not exists public.listing_guarantees (
  listing_id uuid not null references public.listings(id) on delete cascade,
  kind text not null,
  template_key text references public.guarantee_templates(key) on delete restrict,
  custom_terms text,
  custom_remedy text,
  custom_duration_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_guarantees_pkey primary key (listing_id),
  constraint listing_guarantees_kind_check check (kind = any (array['none','template','custom'])),
  constraint listing_guarantees_custom_remedy_check
    check (custom_remedy is null or custom_remedy = any (array['vet_costs','replacement','refund_on_return'])),
  -- Exactly one governing document, enforced by the schema rather than by
  -- convention. This is the constraint legacy did not have.
  constraint listing_guarantees_one_document check (
    case kind
      when 'none'     then template_key is null and custom_terms is null
      when 'template' then template_key is not null and custom_terms is null
      when 'custom'   then template_key is null
                           and custom_terms is not null and btrim(custom_terms) <> ''
                           and custom_remedy is not null
                           and custom_duration_days is not null and custom_duration_days > 0
    end
  )
);

alter table public.listing_guarantees enable row level security;
create policy "read listing guarantees" on public.listing_guarantees
for select to anon, authenticated using (true);
create policy "seller writes own listing guarantee" on public.listing_guarantees
for all to authenticated
using (exists (select 1 from public.listings l
                where l.id = listing_guarantees.listing_id and l.seller_id = (select auth.uid())))
with check (exists (select 1 from public.listings l
                where l.id = listing_guarantees.listing_id and l.seller_id = (select auth.uid())));

/**
 * The buyer-facing text, and the ONLY source of it.
 *
 * The preview a seller sees before publishing and the text a buyer reads on the
 * listing both call this. Ruling 3 promised sellers "a preview of exactly how
 * their terms will read to a buyer" — a preview rendered from a different code
 * path is a preview that can lie, and the whole fairness of resolving ambiguity
 * against the seller rests on them having seen the real thing.
 *
 * A listing with no row returns the explicit no-guarantee text rather than
 * nothing. Same rule as ListingVerificationPanel: a stated absence, never an
 * absence. The dispute policy depends on it — "if a seller published no
 * guarantee, the listing said so plainly and the buyer accepted that".
 */
create or replace function public.listing_guarantee_text(target_listing uuid)
returns table (
  kind text,
  headline text,
  body text,
  remedy text,
  remedy_sentence text,
  duration_days integer,
  conditions text[]
)
language sql stable security definer set search_path = public as $fn$
  with g as (
    select lg.kind, lg.template_key, lg.custom_terms, lg.custom_remedy, lg.custom_duration_days
      from public.listing_guarantees lg where lg.listing_id = target_listing
  ),
  resolved as (
    select
      coalesce((select kind from g), 'none') as kind,
      t.name, t.coverage_description, t.conditions,
      coalesce((select custom_remedy from g), t.remedy) as remedy,
      coalesce((select custom_duration_days from g), t.duration_days) as duration_days,
      (select custom_terms from g) as custom_terms
    from (select 1) one
    left join public.guarantee_templates t on t.key = (select template_key from g)
  )
  select
    r.kind,
    case r.kind
      when 'none'     then 'No health guarantee'
      when 'template' then r.name
      else 'Seller''s own terms'
    end,
    case r.kind
      when 'none'     then 'This seller offers no health guarantee on this animal. Anything you are told outside the listing is between you and the seller.'
      when 'template' then r.coverage_description
      else r.custom_terms
    end,
    r.remedy,
    case r.remedy
      when 'vet_costs'        then 'If it applies, the seller reimburses veterinary costs up to the purchase price. You keep the animal.'
      when 'replacement'      then 'If it applies, the seller offers a replacement animal. You keep the animal unless you agree otherwise.'
      when 'refund_on_return' then 'If it applies, you are refunded once the animal is returned to the seller.'
      else null
    end,
    r.duration_days,
    coalesce(r.conditions, '{}')
  from resolved r;
$fn$;
revoke execute on function public.listing_guarantee_text(uuid) from public;
grant execute on function public.listing_guarantee_text(uuid) to anon, authenticated;

/**
 * Which §4 settlement branch this listing's guarantee points at, so an
 * adjudicator is applying the seller's OWN published remedy rather than choosing
 * one. Returns null when no guarantee was published — that case releases funds
 * under the dispute policy and there is nothing to adjudicate.
 */
create or replace function public.listing_guarantee_branch(target_listing uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select case remedy
    when 'vet_costs'        then 'guarantee_vet_costs'
    when 'replacement'      then 'guarantee_replacement'
    when 'refund_on_return' then 'guarantee_refund_on_return'
  end
  from public.listing_guarantee_text(target_listing)
  where kind <> 'none';
$fn$;
revoke execute on function public.listing_guarantee_branch(uuid) from anon, public;
grant execute on function public.listing_guarantee_branch(uuid) to authenticated;
