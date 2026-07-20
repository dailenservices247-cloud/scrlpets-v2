-- Phase 8: marketplace listing inquiry + evidence spine.
-- Provider-free: no payments, KYC, provenance, or verification claims.
-- Dev project only: irpayabloogarxwtjmrf.
-- Rollback: supabase-dev/phase8-marketplace-inquiries-rollback.sql

create table public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_title_snapshot text not null,
  price_cents_snapshot integer not null check (price_cents_snapshot >= 0),
  creature_id_snapshot uuid,
  creature_name_snapshot text,
  brand_id_snapshot uuid,
  brand_name_snapshot text,
  listing_created_at_snapshot timestamptz not null,
  created_at timestamptz not null default now(),
  constraint listing_inquiries_not_self check (buyer_id <> seller_id),
  unique (listing_id, buyer_id)
);

create index idx_listing_inquiries_conversation_created
  on public.listing_inquiries(conversation_id, created_at desc);
create index idx_listing_inquiries_buyer_created
  on public.listing_inquiries(buyer_id, created_at desc);
create index idx_listing_inquiries_seller_created
  on public.listing_inquiries(seller_id, created_at desc);

alter table public.listing_inquiries enable row level security;

create policy "inquiry participants read"
on public.listing_inquiries
for select to authenticated
using ((select auth.uid()) in (buyer_id, seller_id));

grant select on public.listing_inquiries to authenticated;
revoke insert, update, delete
  on public.listing_inquiries
  from anon, authenticated, public;

create or replace function public.start_listing_inquiry(target_listing_id uuid)
returns table (
  inquiry_id uuid,
  conversation_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  target_listing public.listings%rowtype;
  target_creature_name text;
  target_brand_name text;
  conversation_user_a uuid;
  conversation_user_b uuid;
  resolved_conversation_id uuid;
  resolved_inquiry_id uuid;
begin
  if caller_id is null then
    raise exception 'auth_required';
  end if;

  select l.* into target_listing
    from public.listings l
   where l.id = target_listing_id
     and l.deleted_at is null;

  if target_listing.id is null then
    raise exception 'listing_unavailable';
  end if;
  if target_listing.seller_id = caller_id
     or (
       target_listing.brand_id is not null
       and public.is_brand_member(target_listing.brand_id)
     ) then
    raise exception 'self_inquiry';
  end if;

  select i.id, i.conversation_id
    into resolved_inquiry_id, resolved_conversation_id
    from public.listing_inquiries i
   where i.listing_id = target_listing.id
     and i.buyer_id = caller_id;

  if resolved_inquiry_id is not null then
    return query
    select resolved_inquiry_id, resolved_conversation_id, false;
    return;
  end if;

  if caller_id < target_listing.seller_id then
    conversation_user_a := caller_id;
    conversation_user_b := target_listing.seller_id;
  else
    conversation_user_a := target_listing.seller_id;
    conversation_user_b := caller_id;
  end if;

  select c.id into resolved_conversation_id
    from public.conversations c
   where c.user_a = conversation_user_a
     and c.user_b = conversation_user_b;

  if resolved_conversation_id is null then
    insert into public.conversations (user_a, user_b)
    values (conversation_user_a, conversation_user_b)
    on conflict (user_a, user_b) do nothing
    returning id into resolved_conversation_id;

    if resolved_conversation_id is null then
      select c.id into resolved_conversation_id
        from public.conversations c
       where c.user_a = conversation_user_a
         and c.user_b = conversation_user_b;
    end if;
  end if;

  if target_listing.creature_id is not null then
    select c.name into target_creature_name
      from public.creatures c
     where c.id = target_listing.creature_id;
  end if;

  if target_listing.brand_id is not null then
    select b.name into target_brand_name
      from public.brands b
     where b.id = target_listing.brand_id;
  end if;

  insert into public.listing_inquiries (
    listing_id,
    conversation_id,
    buyer_id,
    seller_id,
    listing_title_snapshot,
    price_cents_snapshot,
    creature_id_snapshot,
    creature_name_snapshot,
    brand_id_snapshot,
    brand_name_snapshot,
    listing_created_at_snapshot
  )
  values (
    target_listing.id,
    resolved_conversation_id,
    caller_id,
    target_listing.seller_id,
    target_listing.title,
    target_listing.price_cents,
    target_listing.creature_id,
    target_creature_name,
    target_listing.brand_id,
    target_brand_name,
    target_listing.created_at
  )
  on conflict (listing_id, buyer_id) do nothing
  returning id into resolved_inquiry_id;

  if resolved_inquiry_id is null then
    select i.id, i.conversation_id
      into resolved_inquiry_id, resolved_conversation_id
      from public.listing_inquiries i
     where i.listing_id = target_listing.id
       and i.buyer_id = caller_id;

    return query
    select resolved_inquiry_id, resolved_conversation_id, false;
    return;
  end if;

  return query
  select resolved_inquiry_id, resolved_conversation_id, true;
end;
$$;

revoke execute on function public.start_listing_inquiry(uuid)
  from anon, public;
grant execute on function public.start_listing_inquiry(uuid)
  to authenticated;
