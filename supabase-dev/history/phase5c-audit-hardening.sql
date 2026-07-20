-- Phase 5c: audit hardening (applied via MCP 2026-07-01). Zero behavior change.
-- 1. revoke RPC access to signup trigger fn (advisor 0028/0029)
-- 2. drop storage broad-select — bucket is public; getPublicUrl needs no policy (advisor 0025)
-- 3. wrap auth.uid() in (select ...) in all 12 flagged policies (advisor 0003)
-- 4. cover 12 unindexed FKs (advisor 0001)

revoke execute on function public.handle_new_user() from anon, authenticated, public;

drop policy "media public read" on storage.objects;

drop policy "own insert creatures" on public.creatures;
create policy "own insert creatures" on public.creatures
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy "own update profiles" on public.profiles;
create policy "own update profiles" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "conv participant read" on public.conversations;
create policy "conv participant read" on public.conversations
  for select to authenticated using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

drop policy "conv participant insert" on public.conversations;
create policy "conv participant insert" on public.conversations
  for insert to authenticated with check (user_a = (select auth.uid()) or user_b = (select auth.uid()));

drop policy "msg participant read" on public.messages;
create policy "msg participant read" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id
              and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid())))
  );

drop policy "msg participant insert" on public.messages;
create policy "msg participant insert" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.conversations c
                where c.id = conversation_id
                  and (c.user_a = (select auth.uid()) or c.user_b = (select auth.uid())))
  );

drop policy "own insert brands" on public.brands;
create policy "own insert brands" on public.brands
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy "read own memberships" on public.brand_memberships;
create policy "read own memberships" on public.brand_memberships
  for select to authenticated using (profile_id = (select auth.uid()));

drop policy "own insert memberships" on public.brand_memberships;
create policy "own insert memberships" on public.brand_memberships
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.brands b
                where b.id = brand_id and b.owner_id = (select auth.uid()))
  );

drop policy "own insert posts" on public.posts;
create policy "own insert posts" on public.posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      posting_as_type = 'person'
      or (
        posting_as_type = 'brand'
        and brand_id is not null
        and exists (select 1 from public.brand_memberships m
                    where m.brand_id = posts.brand_id and m.profile_id = (select auth.uid()))
      )
    )
  );

drop policy "own insert listings" on public.listings;
create policy "own insert listings" on public.listings
  for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and (
      posting_as_type = 'person'
      or (
        posting_as_type = 'brand'
        and brand_id is not null
        and exists (select 1 from public.brand_memberships m
                    where m.brand_id = listings.brand_id and m.profile_id = (select auth.uid()))
      )
    )
  );

create index if not exists idx_posts_author_id on public.posts(author_id);
create index if not exists idx_posts_brand_id on public.posts(brand_id);
create index if not exists idx_posts_tagged_creature_id on public.posts(tagged_creature_id);
create index if not exists idx_listings_seller_id on public.listings(seller_id);
create index if not exists idx_listings_brand_id on public.listings(brand_id);
create index if not exists idx_listings_creature_id on public.listings(creature_id);
create index if not exists idx_promos_author_id on public.promos(author_id);
create index if not exists idx_creatures_owner_id on public.creatures(owner_id);
create index if not exists idx_brands_owner_id on public.brands(owner_id);
create index if not exists idx_brand_memberships_profile_id on public.brand_memberships(profile_id);
create index if not exists idx_conversations_user_b on public.conversations(user_b);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
