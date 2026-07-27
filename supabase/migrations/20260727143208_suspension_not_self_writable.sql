-- Phase 3 fix. profiles.suspended_at sat behind the "own row" UPDATE policy,
-- so a suspended member could clear their own suspension — the banned
-- self-writable-flag class. Suspension moves to its own table with NO client
-- write policy, same shape as identity_verifications.

create table if not exists public.account_suspensions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  suspended_at timestamptz default now() not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text,
  constraint account_suspensions_pkey primary key (profile_id)
);
alter table public.account_suspensions enable row level security;
-- Readable (a suspended user must be able to see that they are suspended);
-- deliberately no insert/update/delete policy for any client role.
create policy "read suspensions" on public.account_suspensions
for select to anon, authenticated using (true);

create or replace function public.is_suspended(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_suspensions where profile_id = target_profile);
$$;

create or replace function public.resolve_report(
  target_report uuid, decision text, notes text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r record;
  subject uuid;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if decision not in ('dismissed','content_hidden','account_suspended') then
    raise exception 'invalid_decision';
  end if;
  select * into r from public.content_reports where id = target_report;
  if r is null then raise exception 'not_found'; end if;

  if decision = 'content_hidden' then
    if r.target_kind = 'post' then
      update public.posts set deleted_at = now() where id = r.target_id and deleted_at is null;
    elsif r.target_kind = 'listing' then
      update public.listings set deleted_at = now() where id = r.target_id and deleted_at is null;
    elsif r.target_kind = 'comment' then
      update public.comments set body = '', deleted_at = now()
       where id = r.target_id and deleted_at is null;
    end if;
  elsif decision = 'account_suspended' then
    -- For a profile report the target IS the account; for content, its author.
    subject := case r.target_kind
      when 'profile' then r.target_id
      when 'post' then (select author_id from public.posts where id = r.target_id)
      when 'listing' then (select seller_id from public.listings where id = r.target_id)
      when 'comment' then (select author_id from public.comments where id = r.target_id)
    end;
    if subject is not null then
      insert into public.account_suspensions (profile_id, actor_id, reason)
      values (subject, uid, notes)
      on conflict (profile_id) do nothing;
    end if;
  end if;

  update public.content_reports
     set status = 'resolved', resolved_by = uid, resolved_at = now(), resolution = decision
   where id = target_report;

  insert into public.moderation_actions (report_id, actor_id, action, target_kind, target_id, notes)
  values (target_report, uid, decision, r.target_kind, r.target_id, notes);
end; $$;
revoke execute on function public.resolve_report(uuid, text, text) from anon, public;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;

alter table public.profiles drop column if exists suspended_at;
