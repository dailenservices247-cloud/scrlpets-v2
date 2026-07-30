-- The cold-DM request gate could be walked straight around.
--
-- `conversations` had exactly two policies, both permissive, and neither said
-- anything about `status`:
--
--   INSERT "conv participant insert"  user_a = auth.uid() OR user_b = auth.uid()
--   SELECT "conv participant read"    same
--
-- and `status` DEFAULTs to 'active'. So any authenticated client could insert a
-- conversation with itself as a participant and status 'active' — verified
-- against dev, the insert succeeded — and since the restrictive
-- "request gate on message send" policy decides by READING conversations.status,
-- a forged 'active' also defeats the send gate. The whole A.6 message-request
-- feature was advisory: it held only for clients that chose to respect it.
--
-- The rule this restores: an active conversation is either EARNED (an accepted
-- pack link — consent already given) or MINTED BY A DEFINER RPC that verified
-- real evidence (start_listing_inquiry checks the listing exists and that the
-- caller is not the seller). SECURITY DEFINER functions bypass RLS, so those
-- paths are unaffected by the policy below; only direct client inserts are
-- constrained, which is exactly where the forgery lived.
--
-- initiated_by is pinned to the caller too: resolve_message_request refuses the
-- initiator, so a spoofed initiated_by would let someone accept their own knock.

create policy "conversation status is earned not declared" on public.conversations
as restrictive
for insert to authenticated
with check (
  initiated_by = (select auth.uid())
  and (
    status = 'request'
    or exists (
      select 1 from public.pack_links p
      where p.status = 'accepted'
        and least(p.requester_id, p.addressee_id) = least(conversations.user_a, conversations.user_b)
        and greatest(p.requester_id, p.addressee_id) = greatest(conversations.user_a, conversations.user_b)
    )
  )
);
