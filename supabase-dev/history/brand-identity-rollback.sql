-- Rollback for 20260723001028_brand_identity. Documentation only.
drop function if exists public.set_brand_identity(uuid, text, text);
alter table public.brands drop column if exists banner_url;
