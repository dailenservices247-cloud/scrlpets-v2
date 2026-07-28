-- The review author may retract their own review.
--
-- The original migration shipped with no DELETE policy at all, reasoning that
-- a seller must not be able to make criticism disappear. That half is right
-- and unchanged — this policy is scoped to the REVIEWER, never the subject.
--
-- But it also meant a buyer who wrote something in anger, or included a
-- detail about themselves they later regretted, had no way to take it back.
-- Someone should be able to retract their own words about their own
-- transaction.
--
-- The tradeoff, stated so it is not discovered later: a seller can now ask a
-- buyer to delete a bad review, and a buyer can comply. The protection that
-- matters is that the seller cannot do it themselves, and cannot edit the
-- words either — both remain impossible.

create policy "author deletes own review" on public.reviews
for delete to authenticated
using (reviewer_id = (select auth.uid()));
