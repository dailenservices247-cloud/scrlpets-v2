-- Rollback for 20260723025415_subject_layer. Documentation only.
drop trigger if exists posts_subject_exists on public.posts;
drop trigger if exists listings_subject_exists on public.listings;
drop function if exists public.enforce_subject_exists();
alter type public.about_type rename to about_type_new;
create type public.about_type as enum ('none','animal','litter','product','service','brand','collaboration');
alter table public.posts alter column about_type drop default;
alter table public.posts alter column about_type type public.about_type using about_type::text::public.about_type;
alter table public.posts alter column about_type set default 'none';
alter table public.listings alter column about_type drop default;
alter table public.listings alter column about_type type public.about_type using about_type::text::public.about_type;
alter table public.listings alter column about_type set default 'none';
drop type public.about_type_new;
drop table if exists public.litters;
drop table if exists public.services;
