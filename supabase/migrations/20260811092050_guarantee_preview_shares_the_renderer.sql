-- The buyer's-eye preview, sharing the renderer rather than copying it.
--
-- Ruling 3 promised sellers "a preview of exactly how their terms will read to a
-- buyer", and the whole fairness of resolving ambiguity against the seller rests
-- on them having seen the real thing. A preview rendered by a second code path
-- is a preview that can drift, and the day it drifts is the day contra
-- proferentem becomes unfair.
--
-- But listing_guarantee_text() takes a listing id, and at compose time the
-- listing does not exist yet. So the renderer is split out and takes the raw
-- choice; listing_guarantee_text() becomes a lookup that delegates to it. One
-- set of words, two ways in.

create or replace function public.guarantee_text_for(
  g_kind text,
  g_template_key text default null,
  g_custom_terms text default null,
  g_custom_remedy text default null,
  g_custom_duration_days integer default null
)
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
  with t as (
    select * from public.guarantee_templates where key = g_template_key
  )
  select
    coalesce(g_kind, 'none'),
    case coalesce(g_kind, 'none')
      when 'none'     then 'No health guarantee'
      when 'template' then (select name from t)
      else 'Seller''s own terms'
    end,
    case coalesce(g_kind, 'none')
      when 'none'     then 'This seller offers no health guarantee on this animal. Anything you are told outside the listing is between you and the seller.'
      when 'template' then (select coverage_description from t)
      else g_custom_terms
    end,
    case coalesce(g_kind, 'none')
      when 'none'     then null
      when 'template' then (select remedy from t)
      else g_custom_remedy
    end,
    case
      when coalesce(g_kind, 'none') = 'none' then null
      else case coalesce((select remedy from t), g_custom_remedy)
        when 'vet_costs'        then 'If it applies, the seller reimburses veterinary costs up to the purchase price. You keep the animal.'
        when 'replacement'      then 'If it applies, the seller offers a replacement animal. You keep the animal unless you agree otherwise.'
        when 'refund_on_return' then 'If it applies, you are refunded once the animal is returned to the seller.'
        else null
      end
    end,
    case coalesce(g_kind, 'none')
      when 'none'     then null
      when 'template' then (select duration_days from t)
      else g_custom_duration_days
    end,
    case coalesce(g_kind, 'none')
      when 'template' then coalesce((select conditions from t), '{}')
      else '{}'::text[]
    end;
$fn$;
revoke execute on function public.guarantee_text_for(text, text, text, text, integer) from public;
grant execute on function public.guarantee_text_for(text, text, text, text, integer) to anon, authenticated;

/**
 * Now a lookup. The words come from guarantee_text_for, so the seller's preview
 * and the buyer's listing cannot say different things.
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
  select * from public.guarantee_text_for(
    coalesce((select lg.kind from public.listing_guarantees lg where lg.listing_id = target_listing), 'none'),
    (select lg.template_key from public.listing_guarantees lg where lg.listing_id = target_listing),
    (select lg.custom_terms from public.listing_guarantees lg where lg.listing_id = target_listing),
    (select lg.custom_remedy from public.listing_guarantees lg where lg.listing_id = target_listing),
    (select lg.custom_duration_days from public.listing_guarantees lg where lg.listing_id = target_listing)
  );
$fn$;
revoke execute on function public.listing_guarantee_text(uuid) from public;
grant execute on function public.listing_guarantee_text(uuid) to anon, authenticated;
