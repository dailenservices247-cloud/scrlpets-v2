-- Every signup needs a profile. This trigger creates one.
--
-- THIS WAS MISSING FROM SOURCE CONTROL ENTIRELY. `handle_new_user()` was in
-- the baseline because it lives in the `public` schema, but the trigger that
-- calls it sits on `auth.users` — outside `public` — and schema dumps do not
-- include it. So the function existed in the migrations and the trigger
-- existed only inside the original database, where someone had created it by
-- hand and it had worked ever since.
--
-- Consequence, found by standing up a fresh project and signing in: the auth
-- user is created, no profile row follows, and the account is silently broken.
-- Not for one person — for EVERY signup. At launch this would have produced a
-- steady stream of accounts that authenticate successfully and then cannot do
-- anything, with no error anywhere to explain why.
--
-- Recreated from pg_get_triggerdef on the original database.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1) || '_' || left(new.id::text, 4),
    split_part(new.email, '@', 1)
  );
  return new;
end; $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill any auth user who signed in before the trigger existed. Idempotent
-- and safe to re-run: it only touches users with no profile at all.
insert into public.profiles (id, username, display_name)
select
  u.id,
  split_part(u.email, '@', 1) || '_' || left(u.id::text, 4),
  split_part(u.email, '@', 1)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null and u.email is not null
on conflict (id) do nothing;
