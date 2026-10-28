-- Module 1: Discovery, Establishments, Creature-Linked Messaging, and Shared Lineage/Memorial Continuity.
--
-- 1. public_brand_team(target_brand):
--    `brand_memberships` RLS restricts direct table SELECT to the member or a
--    brand manager. On `/b/[slug]`, a researching buyer needs to see the people
--    running that establishment (`owner`, `admin`, `contributor`) and click
--    through to each person's `/u/[username]` profile.
--
-- 2. profile_public_brands(target_profile):
--    `/u/[username]` previously only queried `brands.owner_id = profile.id`,
--    hiding establishments where the person is an `admin` or `contributor`.
--
-- 3. creature_origin_attribution(target_creature):
--    Resolves the establishment (`/b/[slug]`) and breeder (`@username`) behind
--    an animal so `/c/[slug]` links directly to the kennel/store/establishment
--    and honors both breeder and owner attribution after an alumni handover.
--
-- 4. start_creature_inquiry(target_creature_id):
--    Clicking "Message" on `/c/[slug]` previously opened a blank cold DM with
--    no animal attached. This mints or reuses an active inquiry conversation
--    with the animal (and its live listing or establishment) attached in
--    `listing_inquiries`.
--
-- 5. tree_alumni_and_parents(target_owner, only_visible) + owner_lineage_edges:
--    Keeps sold alumni offspring and their memorial status (`deceased_at`)
--    connected to both the breeder's lineage tree and the buyer's lineage tree.

-- ============================================================ 1. BRAND TEAM
create or replace function public.public_brand_team(target_brand uuid)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  role text,
  is_verified boolean
)
language sql stable security definer set search_path = public as $fn$
  select
    p.id as profile_id,
    p.username,
    p.display_name,
    p.avatar_url,
    m.role,
    public.is_verified_seller(p.id) as is_verified
  from public.brand_memberships m
  join public.brands b on b.id = m.brand_id
  join public.profiles p on p.id = m.profile_id
  where m.brand_id = target_brand
    and b.archived_at is null
  order by
    case m.role
      when 'owner' then 1
      when 'admin' then 2
      else 3
    end,
    m.created_at asc;
$fn$;

revoke execute on function public.public_brand_team(uuid) from public;
grant execute on function public.public_brand_team(uuid) to anon, authenticated;

-- ======================================================= 2. PROFILE BRANDS
create or replace function public.profile_public_brands(target_profile uuid)
returns table (
  id uuid,
  name text,
  slug text,
  brand_type public.brand_type,
  avatar_url text,
  banner_url text,
  restrict_posting_to_managers boolean,
  role text
)
language sql stable security definer set search_path = public as $fn$
  select
    b.id,
    b.name,
    b.slug,
    b.brand_type,
    b.avatar_url,
    b.banner_url,
    b.restrict_posting_to_managers,
    m.role
  from public.brand_memberships m
  join public.brands b on b.id = m.brand_id
  where m.profile_id = target_profile
    and b.archived_at is null
  order by
    case m.role
      when 'owner' then 1
      when 'admin' then 2
      else 3
    end,
    b.created_at asc;
$fn$;

revoke execute on function public.profile_public_brands(uuid) from public;
grant execute on function public.profile_public_brands(uuid) to anon, authenticated;

-- ========================================== 3. CREATURE ORIGIN ATTRIBUTION
create or replace function public.creature_origin_attribution(target_creature uuid)
returns table (
  breeder_id uuid,
  breeder_username text,
  breeder_display_name text,
  brand_id uuid,
  brand_name text,
  brand_slug text,
  brand_type text,
  is_alumni boolean
)
language plpgsql stable security definer set search_path = public as $fn$
declare
  c record;
  v_breeder_id uuid;
  v_is_alumni boolean := false;
  v_brand_id uuid;
begin
  select * into c from public.creatures where id = target_creature and archived_at is null;
  if not found then
    return;
  end if;

  -- 1. Check alumni record first (animal changed hands from breeder to owner)
  select a.breeder_id into v_breeder_id
    from public.alumni a
   where a.creature_id = target_creature
   order by a.handover_at desc
   limit 1;

  if v_breeder_id is not null and v_breeder_id <> c.owner_id then
    v_is_alumni := true;
  end if;

  -- 2. Check litter attribution if present
  if c.litter_id is not null then
    select coalesce(v_breeder_id, lt.owner_id), lt.brand_id
      into v_breeder_id, v_brand_id
      from public.litters lt
     where lt.id = c.litter_id;
  end if;

  -- 3. Check listing brand attribution
  if v_brand_id is null then
    select l.brand_id into v_brand_id
      from public.listings l
     where l.creature_id = target_creature
       and l.brand_id is not null
       and l.deleted_at is null
     order by l.created_at desc
     limit 1;
  end if;

  -- 4. Check post brand attribution
  if v_brand_id is null then
    select p.brand_id into v_brand_id
      from public.posts p
     where p.tagged_creature_id = target_creature
       and p.brand_id is not null
       and p.deleted_at is null
     order by p.created_at desc
     limit 1;
  end if;

  -- 5. Fallback to the breeder's (or current owner's) primary active establishment
  if v_brand_id is null then
    select b.id into v_brand_id
      from public.brands b
     where b.owner_id = coalesce(v_breeder_id, c.owner_id)
       and b.archived_at is null
     order by
       case when b.brand_type in ('kennel', 'pet_shop', 'rescue') then 0 else 1 end,
       b.created_at asc
     limit 1;
  end if;

  if v_breeder_id is null then
    v_breeder_id := c.owner_id;
  end if;

  return query
  select
    pr.id as breeder_id,
    pr.username as breeder_username,
    pr.display_name as breeder_display_name,
    b.id as brand_id,
    b.name as brand_name,
    b.slug as brand_slug,
    b.brand_type::text as brand_type,
    v_is_alumni as is_alumni
  from public.profiles pr
  left join public.brands b on b.id = v_brand_id and b.archived_at is null
  where pr.id = v_breeder_id;
end;
$fn$;

revoke execute on function public.creature_origin_attribution(uuid) from public;
grant execute on function public.creature_origin_attribution(uuid) to anon, authenticated;

-- ============================================== 4. START CREATURE INQUIRY
create or replace function public.start_creature_inquiry(target_creature_id uuid)
returns table (inquiry_id uuid, conversation_id uuid, created boolean)
language plpgsql security definer set search_path = public as $fn$
declare
  caller_id uuid := auth.uid();
  c record;
  active_listing_id uuid;
  origin record;
  conversation_user_a uuid;
  conversation_user_b uuid;
  resolved_conversation_id uuid;
  resolved_inquiry_id uuid;
begin
  if caller_id is null then
    raise exception 'auth_required';
  end if;

  select * into c
    from public.creatures
   where id = target_creature_id
     and archived_at is null;

  if not found then
    raise exception 'creature_unavailable';
  end if;

  if c.owner_id = caller_id then
    raise exception 'self_inquiry';
  end if;

  -- If the animal has a live listing, delegate to start_listing_inquiry so price
  -- and listing context are attached automatically.
  select l.id into active_listing_id
    from public.listings l
   where l.creature_id = c.id
     and l.deleted_at is null
     and l.availability = 'available'
   order by l.created_at desc
   limit 1;

  if active_listing_id is not null then
    return query select * from public.start_listing_inquiry(active_listing_id);
    return;
  end if;

  -- Otherwise open/reuse the active conversation and attach the animal context.
  if caller_id < c.owner_id then
    conversation_user_a := caller_id;
    conversation_user_b := c.owner_id;
  else
    conversation_user_a := c.owner_id;
    conversation_user_b := caller_id;
  end if;

  select conv.id into resolved_conversation_id
    from public.conversations conv
   where conv.user_a = conversation_user_a
     and conv.user_b = conversation_user_b;

  if resolved_conversation_id is null then
    insert into public.conversations (user_a, user_b, status, initiated_by)
    values (conversation_user_a, conversation_user_b, 'active', caller_id)
    on conflict (user_a, user_b) do nothing
    returning id into resolved_conversation_id;

    if resolved_conversation_id is null then
      select conv.id into resolved_conversation_id
        from public.conversations conv
       where conv.user_a = conversation_user_a
         and conv.user_b = conversation_user_b;
    end if;
  end if;

  -- Check if an inquiry for this creature already exists in this conversation
  select i.id into resolved_inquiry_id
    from public.listing_inquiries i
   where i.conversation_id = resolved_conversation_id
     and i.creature_id_snapshot = c.id
     and i.buyer_id = caller_id
   order by i.created_at desc
   limit 1;

  if resolved_inquiry_id is not null then
    return query select resolved_inquiry_id, resolved_conversation_id, false;
    return;
  end if;

  select * into origin from public.creature_origin_attribution(c.id) limit 1;

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
    null,
    resolved_conversation_id,
    caller_id,
    c.owner_id,
    c.name,
    0,
    c.id,
    c.name,
    origin.brand_id,
    origin.brand_name,
    c.created_at
  )
  returning id into resolved_inquiry_id;

  return query select resolved_inquiry_id, resolved_conversation_id, true;
end;
$fn$;

revoke execute on function public.start_creature_inquiry(uuid) from anon, public;
grant execute on function public.start_creature_inquiry(uuid) to authenticated;

-- ============================ 5. SHARED LINEAGE & MEMORIAL CONTINUITY
-- `alumni` is readable only by the two parties (`breeder_id` or `owner_id`), so
-- a public visitor viewing a breeder's `/u/[username]/tree` cannot read `alumni`
-- directly. This boolean definer answers ONLY whether `target_creature` is an
-- unmuted alumnus of `target_breeder`, leaking no buyer or application data.
create or replace function public.is_breeder_alumni(target_creature uuid, target_breeder uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.alumni a
     where a.creature_id = target_creature
       and a.breeder_id = target_breeder
       and not a.muted_by_breeder
  );
$fn$;

revoke execute on function public.is_breeder_alumni(uuid, uuid) from public;
grant execute on function public.is_breeder_alumni(uuid, uuid) to anon, authenticated;

-- Include alumni offspring (for the breeder's tree) and parent lineage edges
-- (for the buyer's tree) in owner_lineage_edges so a handover or memorial stays
-- connected across both families' trees.
create or replace function public.owner_lineage_edges(target_owner uuid)
returns table (creature_id uuid, parent_id uuid, parent_type text)
language sql stable security invoker set search_path = public as $fn$
  select distinct l.creature_id, l.parent_id, l.parent_type
    from public.creature_lineage l
    join public.creatures c on c.id = l.creature_id
   where c.archived_at is null
     and (
       c.owner_id = target_owner
       or public.is_breeder_alumni(c.id, target_owner)
     );
$fn$;

revoke execute on function public.owner_lineage_edges(uuid) from public;
grant execute on function public.owner_lineage_edges(uuid) to anon, authenticated;

-- Returns extended tree creatures (alumni offspring for a breeder + visible
-- parents of owned animals for a buyer) so both the breeder's tree and the
-- buyer's tree retain shared lineage and memorial (`deceased_at`) continuity.
create or replace function public.tree_extended_creatures(target_owner uuid, only_visible boolean default true)
returns table (
  id uuid,
  name text,
  species text,
  slug text,
  avatar_url text,
  creature_role text,
  in_roster boolean,
  page_visible boolean,
  deceased_at date,
  memorial_message text,
  birth_date date,
  breed text,
  gender text
)
language sql stable security definer set search_path = public as $fn$
  select distinct
    c.id,
    c.name,
    c.species,
    c.slug,
    c.avatar_url,
    c.creature_role,
    false as in_roster,
    c.page_visible,
    c.deceased_at,
    c.memorial_message,
    c.birth_date,
    c.breed,
    c.gender
  from public.creatures c
  where c.archived_at is null
    and c.owner_id <> target_owner
    and (not only_visible or c.page_visible = true)
    and (
      -- 1. Alumni offspring bred by target_owner that now belong to a buyer
      public.is_breeder_alumni(c.id, target_owner)
      -- 2. Parents (sire/dam) of creatures owned by target_owner
      or exists (
        select 1
          from public.creature_lineage l
          join public.creatures child on child.id = l.creature_id
         where l.parent_id = c.id
           and child.owner_id = target_owner
           and child.archived_at is null
      )
    );
$fn$;

revoke execute on function public.tree_extended_creatures(uuid, boolean) from public;
grant execute on function public.tree_extended_creatures(uuid, boolean) to anon, authenticated;
