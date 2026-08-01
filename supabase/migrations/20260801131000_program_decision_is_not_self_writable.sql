-- Found while adding rejection_reason: the applicant writes the decision.
--
-- `own insert seller programs` checks profile_id and brand_id and nothing else,
-- and there is no client UPDATE policy — so the self-approval that trust-core
-- proves is impossible on UPDATE is trivially possible on INSERT. Probed on dev
-- as the seller fixture through RLS:
--
--   insert into seller_programs(profile_id, program_type, credential_number,
--                               issuing_authority, status)
--   values (auth.uid(), 'kennel', 'SELF', 'Self Authority', 'approved');
--   -- inserted, status = approved
--
-- Today that only lies to the person doing it: the single reader of
-- `status = 'approved'` is getReadiness(), a self-facing checklist on the
-- author's own dashboard. It is fixed anyway for two reasons. It is one
-- consumer away from being a real escalation — the moment an approved program
-- earns a public badge or unlocks a listing type, every account can grant
-- itself one. And rejection_reason, added in 20260801130100, is worth having
-- only if the reviewer is the one who wrote it; a column the subject can
-- pre-stamp is not a reviewer's decision, it is a suggestion.
--
-- RESTRICTIVE so it ANDs onto the existing policy instead of replacing it —
-- profile_id and brand_id ownership stay exactly as they are. A submission is
-- pending, unreviewed and unexplained, full stop; every one of these columns is
-- written afterwards by review_seller_program(), which is a definer and is not
-- subject to this.
create policy "program decisions are not self-writable" on public.seller_programs
as restrictive for insert to authenticated
with check (
  coalesce(status, 'pending') = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
  and rejection_reason is null
);
