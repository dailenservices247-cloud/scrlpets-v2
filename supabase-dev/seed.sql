-- Slice-1 dummy data for the development database.
-- NOTE: profiles.id has an FK to auth.users, so a standalone seed profile is impossible.
-- The seed identity is a real dev auth user (also the Playwright E2E user):
--   email scrlpets-e2e@scrlpets.com
--   created via insert into auth.users + auth.identities with fixed id ...0001;
--   the on_auth_user_created trigger created its profile, then username was set to breeder_jane.

update public.profiles
   set username = 'breeder_jane', display_name = 'Jane B.'
 where id = '00000000-0000-0000-0000-000000000001';

insert into public.creatures (id, owner_id, name, species, slug, avatar_url) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','Max','dog','max-c1', null),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000001','Luna','cat','luna-c2', null)
on conflict do nothing;

insert into public.posts (author_id, content_type, body, tagged_creature_id) values
  ('00000000-0000-0000-0000-000000000001','post','Max learned to sit today.','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-000000000001','reel','15s of Luna being dramatic.','00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-000000000001','long_video','Full grooming walkthrough.','00000000-0000-0000-0000-0000000000c1');

insert into public.listings (seller_id, title, price_cents, creature_id) values
  ('00000000-0000-0000-0000-000000000001','AKC Golden pup — health tested', 250000, '00000000-0000-0000-0000-0000000000c1');

insert into public.promos (author_id, title, body) values
  ('00000000-0000-0000-0000-000000000001','20% off first vet-check','Partner promo for new members.');

-- Verified: select kind, subtype, count(*) → post/reel/long_video/listing/promo = 1 each.
