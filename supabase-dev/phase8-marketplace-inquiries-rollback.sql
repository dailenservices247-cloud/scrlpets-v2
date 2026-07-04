-- Roll back Phase 8 marketplace inquiries.
-- WARNING: this deletes all listing inquiry snapshots. Export production rows
-- before rollback if real buyer inquiries exist.

drop function public.start_listing_inquiry(uuid);
drop policy "inquiry participants read" on public.listing_inquiries;
drop table public.listing_inquiries;
