-- A rejected applicant sees `rejected` and nothing else.
--
-- 20260730200412 closed `seller_programs.review_notes` to the person it is
-- written about, and said in as many words that telling an applicant why they
-- were rejected is a real thing to want and that it wants its own column. This
-- is that column.
--
-- It is NOT the staff note, and the difference is the entire point: a reviewer
-- who knows the applicant will read their note writes a different note. Reusing
-- review_notes for this would both destroy the internal record and turn every
-- rejection into free-text the platform then owns. So the applicant-facing
-- reason is a fixed code, translated in the client, and the note stays internal
-- and unchanged.
alter table public.seller_programs
  add column if not exists rejection_reason text;

-- Null for pending and approved rows; one of five codes on a rejection. The
-- CHECK is what makes the column a code and not free text — the function below
-- passes the value straight through, so this constraint is the only thing
-- standing between a reviewer and a paragraph.
alter table public.seller_programs
  drop constraint if exists seller_programs_rejection_reason_check;
alter table public.seller_programs
  add constraint seller_programs_rejection_reason_check check (
    rejection_reason is null
    or rejection_reason = any (array[
      'not_found',              -- number not found in the authority's records
      'expired',                -- credential has expired
      'name_mismatch',          -- name does not match the account
      'authority_unrecognised', -- issuing authority not recognised
      'other'                   -- contact support
    ])
  );

-- The column is useless if the applicant cannot read it. 20260730200412 replaced
-- the table-level SELECT grant with a column allowlist, and a column added after
-- an allowlist is NOT in it — the applicant's own settings page would have got
-- 42501 on every load. This grant is the working half of the feature.
grant select (rejection_reason) on public.seller_programs to authenticated;

-- DROP, then CREATE. `create or replace function` with a different parameter
-- count does not replace anything — it creates a second overload and leaves the
-- old one resolvable, which is how a changed definer shipped "successfully" on
-- 20260730 while its caller went on invoking the stale version. There is
-- exactly one caller (reviewSellerProgram in src/lib/verification/actions.ts)
-- and it moves to the new signature in the same change.
drop function if exists public.review_seller_program(uuid, text, text);

create function public.review_seller_program(
  target_program uuid,
  decision text,
  notes text default null,
  reason_code text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner_profile uuid;
begin
  if not public.is_platform_admin() then raise exception 'admin_required'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  -- A rejection without a reason is the bug this migration exists to fix, so it
  -- is refused at the source rather than left to the admin UI to remember.
  if decision = 'rejected' and coalesce(reason_code, '') = '' then
    raise exception 'reason_required';
  end if;
  update public.seller_programs
     set status = decision,
         reviewed_by = uid,
         reviewed_at = now(),
         review_notes = notes,
         -- Cleared on approval: a re-reviewed row must not keep explaining a
         -- rejection that no longer stands.
         rejection_reason = case when decision = 'rejected' then reason_code else null end
   where id = target_program
  returning profile_id into owner_profile;
  if owner_profile is null then raise exception 'not_found'; end if;
  -- detail stays the STAFF note. verification_events is admin-read-only and is
  -- the internal record; the code the applicant sees lives on the row.
  insert into public.verification_events (subject_kind, subject_id, actor_id, action, detail)
  values ('program', target_program, uid, decision, notes);
end; $$;

revoke execute on function public.review_seller_program(uuid, text, text, text) from anon, public;
grant execute on function public.review_seller_program(uuid, text, text, text) to authenticated;
