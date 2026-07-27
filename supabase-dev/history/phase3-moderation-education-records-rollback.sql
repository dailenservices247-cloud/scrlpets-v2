-- Rollback for 20260727142015_moderation_education_records.sql (Phase 3).
drop policy if exists "suspended cannot post" on public.posts;
drop policy if exists "suspended cannot comment" on public.comments;
drop policy if exists "suspended cannot list" on public.listings;
drop policy if exists "admins read all reports" on public.content_reports;
drop function if exists public.resolve_report(uuid, text, text);
drop function if exists public.upsert_guide(text, text, text, text, text, boolean);
drop function if exists public.is_suspended(uuid);
drop table if exists public.moderation_actions;
drop table if exists public.guides;
drop trigger if exists animal_records_vet_guard on public.animal_records;
drop trigger if exists animal_records_vet_guard_insert on public.animal_records;
drop function if exists public.enforce_vet_attestation_immutable();
drop function if exists public.enforce_vet_attestation_absent_on_insert();
drop table if exists public.animal_records;
alter table public.content_reports
  drop column if exists resolved_by, drop column if exists resolved_at, drop column if exists resolution;
alter table public.profiles drop column if exists suspended_at;
