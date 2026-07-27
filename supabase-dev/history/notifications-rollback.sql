-- Rollback for 20260727072753_notifications. Documentation only.
drop trigger if exists follows_notify on public.follows;
drop trigger if exists post_reactions_notify on public.post_reactions;
drop trigger if exists comments_notify on public.comments;
drop trigger if exists listing_inquiries_notify on public.listing_inquiries;
drop function if exists public.on_follow_notify();
drop function if exists public.on_post_reaction_notify();
drop function if exists public.on_comment_notify();
drop function if exists public.on_inquiry_notify();
drop function if exists public.notify(uuid, uuid, text, text, uuid);
drop table if exists public.notifications;
