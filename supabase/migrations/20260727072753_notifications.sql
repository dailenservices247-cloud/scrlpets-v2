-- Phase 1 / R12: in-app notification center (D7 locked: in-app only, email + push banked).
-- Rows are written by security-definer triggers on the events that matter, so a
-- client can never fabricate a notification for someone else.

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  -- What the notification points at. Kept loose (no FK) because targets span
  -- posts/comments/listings; the reader resolves and skips dead targets.
  target_kind text,
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz default now() not null,
  constraint notifications_pkey primary key (id),
  constraint notifications_kind_check check (
    kind = any (array['follow','reaction','comment','comment_reply','inquiry'])
  ),
  constraint notifications_target_kind_check check (
    target_kind is null or target_kind = any (array['post','comment','listing','profile'])
  )
);

create index if not exists idx_notifications_recipient
  on public.notifications using btree (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- Owner-only in every direction: you read and mark your own; nobody inserts directly.
create policy "own read notifications" on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "own update notifications" on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy "own delete notifications" on public.notifications
for delete to authenticated
using (recipient_id = (select auth.uid()));

-- Central writer. Never notifies you about your own action, and never notifies
-- across a block in either direction.
create or replace function public.notify(
  target_recipient uuid,
  target_actor uuid,
  notification_kind text,
  ref_kind text default null,
  ref_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_recipient is null or target_actor is null then return; end if;
  if target_recipient = target_actor then return; end if;
  if public.is_blocked_between(target_recipient, target_actor) then return; end if;
  insert into public.notifications (recipient_id, actor_id, kind, target_kind, target_id)
  values (target_recipient, target_actor, notification_kind, ref_kind, ref_id);
end;
$$;

revoke execute on function public.notify(uuid, uuid, text, text, uuid) from anon, authenticated, public;

-- follows
create or replace function public.on_follow_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.following_id, new.follower_id, 'follow', 'profile', new.follower_id);
  return new;
end; $$;
create trigger follows_notify after insert on public.follows
for each row execute function public.on_follow_notify();

-- post reactions
create or replace function public.on_post_reaction_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  perform public.notify(author, new.user_id, 'reaction', 'post', new.post_id);
  return new;
end; $$;
create trigger post_reactions_notify after insert on public.post_reactions
for each row execute function public.on_post_reaction_notify();

-- comments (and replies)
create or replace function public.on_comment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare post_author uuid; parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  perform public.notify(post_author, new.author_id, 'comment', 'post', new.post_id);
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    -- Don't double-notify a post author who also owns the parent comment.
    if parent_author is distinct from post_author then
      perform public.notify(parent_author, new.author_id, 'comment_reply', 'post', new.post_id);
    end if;
  end if;
  return new;
end; $$;
create trigger comments_notify after insert on public.comments
for each row execute function public.on_comment_notify();

-- listing inquiries: tell the seller.
create or replace function public.on_inquiry_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- listing_inquiries already carries seller_id in its snapshot.
  perform public.notify(new.seller_id, new.buyer_id, 'inquiry', 'listing', new.listing_id);
  return new;
end; $$;
create trigger listing_inquiries_notify after insert on public.listing_inquiries
for each row execute function public.on_inquiry_notify();
