


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."about_type" AS ENUM (
    'none',
    'animal',
    'litter',
    'product',
    'service',
    'brand',
    'collaboration'
);


ALTER TYPE "public"."about_type" OWNER TO "postgres";


CREATE TYPE "public"."brand_type" AS ENUM (
    'kennel',
    'llc',
    'pet_shop',
    'product_brand',
    'rescue',
    'service_provider',
    'creator',
    'independent_seller'
);


ALTER TYPE "public"."brand_type" OWNER TO "postgres";


CREATE TYPE "public"."content_type" AS ENUM (
    'post',
    'reel',
    'long_video'
);


ALTER TYPE "public"."content_type" OWNER TO "postgres";


CREATE TYPE "public"."posting_as_type" AS ENUM (
    'person',
    'brand'
);


ALTER TYPE "public"."posting_as_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_brand_member"("target_brand_id" "uuid", "target_profile_id" "uuid", "target_role" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  caller_role text;
  membership_id uuid;
  primary_owner_id uuid;
begin
  caller_role := public.brand_membership_role(target_brand_id);

  if target_role not in ('admin', 'contributor') then
    raise exception 'invalid_role';
  end if;

  if caller_role = 'owner' then
    null;
  elsif caller_role = 'admin' and target_role = 'contributor' then
    null;
  else
    raise exception 'brand_permission_denied';
  end if;

  select b.owner_id into primary_owner_id
    from public.brands b
   where b.id = target_brand_id;

  if primary_owner_id is null then
    raise exception 'brand_not_found';
  end if;
  if target_profile_id = primary_owner_id then
    raise exception 'owner_protected';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise exception 'profile_not_found';
  end if;

  begin
    insert into public.brand_memberships (brand_id, profile_id, role)
    values (target_brand_id, target_profile_id, target_role)
    returning id into membership_id;
  exception
    when unique_violation then
      raise exception 'duplicate_member';
  end;

  insert into public.brand_membership_events (
    brand_id, actor_id, target_profile_id, action, new_role
  )
  values (
    target_brand_id, auth.uid(), target_profile_id, 'member_added', target_role
  );

  return membership_id;
end;
$$;


ALTER FUNCTION "public"."add_brand_member"("target_brand_id" "uuid", "target_profile_id" "uuid", "target_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."brand_membership_role"("target_brand_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select m.role
    from public.brand_memberships m
   where m.brand_id = target_brand_id
     and m.profile_id = auth.uid()
   limit 1;
$$;


ALTER FUNCTION "public"."brand_membership_role"("target_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_brand_member_role"("target_membership_id" "uuid", "target_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_membership public.brand_memberships%rowtype;
  caller_role text;
begin
  if target_role not in ('admin', 'contributor') then
    raise exception 'invalid_role';
  end if;

  select * into target_membership
    from public.brand_memberships m
   where m.id = target_membership_id;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;

  caller_role := public.brand_membership_role(target_membership.brand_id);
  if caller_role <> 'owner' then
    raise exception 'brand_permission_denied';
  end if;
  if target_membership.role = 'owner' then
    raise exception 'owner_protected';
  end if;
  if target_membership.role = target_role then
    return true;
  end if;

  update public.brand_memberships
     set role = target_role
   where id = target_membership.id;

  insert into public.brand_membership_events (
    brand_id, actor_id, target_profile_id, action, previous_role, new_role
  )
  values (
    target_membership.brand_id,
    auth.uid(),
    target_membership.profile_id,
    'role_changed',
    target_membership.role,
    target_role
  );

  return true;
end;
$$;


ALTER FUNCTION "public"."change_brand_member_role"("target_membership_id" "uuid", "target_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_content_identity_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_table_name = 'posts' then
    if new.id is distinct from old.id
       or new.author_id is distinct from old.author_id
       or new.content_type is distinct from old.content_type
       or new.tagged_creature_id is distinct from old.tagged_creature_id
       or new.posting_as_type is distinct from old.posting_as_type
       or new.brand_id is distinct from old.brand_id
       or new.about_type is distinct from old.about_type
       or new.about_id is distinct from old.about_id
       or new.created_at is distinct from old.created_at then
      raise exception 'post identity and attribution are immutable';
    end if;
  elsif tg_table_name = 'listings' then
    if new.id is distinct from old.id
       or new.seller_id is distinct from old.seller_id
       or new.creature_id is distinct from old.creature_id
       or new.posting_as_type is distinct from old.posting_as_type
       or new.brand_id is distinct from old.brand_id
       or new.about_type is distinct from old.about_type
       or new.about_id is distinct from old.about_id
       or new.created_at is distinct from old.created_at then
      raise exception 'listing identity and attribution are immutable';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_content_identity_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email,'@',1) || '_' || left(new.id::text,4), split_part(new.email,'@',1));
  return new;
end; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_brand_manager"("target_brand_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(public.brand_membership_role(target_brand_id) in ('owner', 'admin'), false);
$$;


ALTER FUNCTION "public"."is_brand_manager"("target_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_brand_member"("target_brand_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.brand_membership_role(target_brand_id) is not null;
$$;


ALTER FUNCTION "public"."is_brand_member"("target_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_brand_member"("target_membership_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_membership public.brand_memberships%rowtype;
  caller_role text;
begin
  select * into target_membership
    from public.brand_memberships m
   where m.id = target_membership_id;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;
  if target_membership.role = 'owner' then
    raise exception 'owner_protected';
  end if;

  caller_role := public.brand_membership_role(target_membership.brand_id);
  if target_membership.profile_id = auth.uid() then
    null;
  elsif caller_role = 'owner' then
    null;
  elsif caller_role = 'admin' and target_membership.role = 'contributor' then
    null;
  else
    raise exception 'brand_permission_denied';
  end if;

  delete from public.brand_memberships where id = target_membership.id;

  insert into public.brand_membership_events (
    brand_id, actor_id, target_profile_id, action, previous_role
  )
  values (
    target_membership.brand_id,
    auth.uid(),
    target_membership.profile_id,
    'member_removed',
    target_membership.role
  );

  return true;
end;
$$;


ALTER FUNCTION "public"."remove_brand_member"("target_membership_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_managed_listing"("target_listing_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  affected integer;
begin
  update public.listings as l
     set deleted_at = now()
   where l.id = target_listing_id
     and l.deleted_at is null
     and (
       l.seller_id = auth.uid()
       or (
         l.posting_as_type = 'brand'
         and l.brand_id is not null
         and public.is_brand_manager(l.brand_id)
       )
     );

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;


ALTER FUNCTION "public"."soft_delete_managed_listing"("target_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_own_listing"("target_listing_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  affected integer;
begin
  update public.listings as l
     set deleted_at = now()
   where l.id = target_listing_id
     and l.seller_id = auth.uid()
     and l.deleted_at is null;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;


ALTER FUNCTION "public"."soft_delete_own_listing"("target_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_listing_inquiry"("target_listing_id" "uuid") RETURNS TABLE("inquiry_id" "uuid", "conversation_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  caller_id uuid := auth.uid();
  target_listing public.listings%rowtype;
  target_creature_name text;
  target_brand_name text;
  conversation_user_a uuid;
  conversation_user_b uuid;
  resolved_conversation_id uuid;
  resolved_inquiry_id uuid;
begin
  if caller_id is null then
    raise exception 'auth_required';
  end if;

  select l.* into target_listing
    from public.listings l
   where l.id = target_listing_id
     and l.deleted_at is null;

  if target_listing.id is null then
    raise exception 'listing_unavailable';
  end if;
  if target_listing.seller_id = caller_id
     or (
       target_listing.brand_id is not null
       and public.is_brand_member(target_listing.brand_id)
     ) then
    raise exception 'self_inquiry';
  end if;

  select i.id, i.conversation_id
    into resolved_inquiry_id, resolved_conversation_id
    from public.listing_inquiries i
   where i.listing_id = target_listing.id
     and i.buyer_id = caller_id;

  if resolved_inquiry_id is not null then
    return query
    select resolved_inquiry_id, resolved_conversation_id, false;
    return;
  end if;

  if caller_id < target_listing.seller_id then
    conversation_user_a := caller_id;
    conversation_user_b := target_listing.seller_id;
  else
    conversation_user_a := target_listing.seller_id;
    conversation_user_b := caller_id;
  end if;

  select c.id into resolved_conversation_id
    from public.conversations c
   where c.user_a = conversation_user_a
     and c.user_b = conversation_user_b;

  if resolved_conversation_id is null then
    insert into public.conversations (user_a, user_b)
    values (conversation_user_a, conversation_user_b)
    on conflict (user_a, user_b) do nothing
    returning id into resolved_conversation_id;

    if resolved_conversation_id is null then
      select c.id into resolved_conversation_id
        from public.conversations c
       where c.user_a = conversation_user_a
         and c.user_b = conversation_user_b;
    end if;
  end if;

  if target_listing.creature_id is not null then
    select c.name into target_creature_name
      from public.creatures c
     where c.id = target_listing.creature_id;
  end if;

  if target_listing.brand_id is not null then
    select b.name into target_brand_name
      from public.brands b
     where b.id = target_listing.brand_id;
  end if;

  insert into public.listing_inquiries (
    listing_id,
    conversation_id,
    buyer_id,
    seller_id,
    listing_title_snapshot,
    price_cents_snapshot,
    creature_id_snapshot,
    creature_name_snapshot,
    brand_id_snapshot,
    brand_name_snapshot,
    listing_created_at_snapshot
  )
  values (
    target_listing.id,
    resolved_conversation_id,
    caller_id,
    target_listing.seller_id,
    target_listing.title,
    target_listing.price_cents,
    target_listing.creature_id,
    target_creature_name,
    target_listing.brand_id,
    target_brand_name,
    target_listing.created_at
  )
  on conflict (listing_id, buyer_id) do nothing
  returning id into resolved_inquiry_id;

  if resolved_inquiry_id is null then
    select i.id, i.conversation_id
      into resolved_inquiry_id, resolved_conversation_id
      from public.listing_inquiries i
     where i.listing_id = target_listing.id
       and i.buyer_id = caller_id;

    return query
    select resolved_inquiry_id, resolved_conversation_id, false;
    return;
  end if;

  return query
  select resolved_inquiry_id, resolved_conversation_id, true;
end;
$$;


ALTER FUNCTION "public"."start_listing_inquiry"("target_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."brand_membership_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "target_profile_id" "uuid",
    "action" "text" NOT NULL,
    "previous_role" "text",
    "new_role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "brand_membership_events_action_check" CHECK (("action" = ANY (ARRAY['member_added'::"text", 'role_changed'::"text", 'member_removed'::"text"]))),
    CONSTRAINT "brand_membership_events_new_role_check" CHECK ((("new_role" IS NULL) OR ("new_role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'contributor'::"text"])))),
    CONSTRAINT "brand_membership_events_previous_role_check" CHECK ((("previous_role" IS NULL) OR ("previous_role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'contributor'::"text"]))))
);


ALTER TABLE "public"."brand_membership_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "brand_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'contributor'::"text"])))
);


ALTER TABLE "public"."brand_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "brand_type" "public"."brand_type" NOT NULL,
    "avatar_url" "text",
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slug" "text" NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conv_order" CHECK (("user_a" < "user_b"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "species" "text",
    "slug" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "conversation_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "listing_title_snapshot" "text" NOT NULL,
    "price_cents_snapshot" integer NOT NULL,
    "creature_id_snapshot" "uuid",
    "creature_name_snapshot" "text",
    "brand_id_snapshot" "uuid",
    "brand_name_snapshot" "text",
    "listing_created_at_snapshot" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listing_inquiries_not_self" CHECK (("buyer_id" <> "seller_id")),
    CONSTRAINT "listing_inquiries_price_cents_snapshot_check" CHECK (("price_cents_snapshot" >= 0))
);


ALTER TABLE "public"."listing_inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "media_url" "text",
    "creature_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posting_as_type" "public"."posting_as_type" DEFAULT 'person'::"public"."posting_as_type" NOT NULL,
    "brand_id" "uuid",
    "about_type" "public"."about_type" DEFAULT 'none'::"public"."about_type" NOT NULL,
    "about_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content_type" "public"."content_type" DEFAULT 'post'::"public"."content_type" NOT NULL,
    "body" "text",
    "media_url" "text",
    "tagged_creature_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posting_as_type" "public"."posting_as_type" DEFAULT 'person'::"public"."posting_as_type" NOT NULL,
    "brand_id" "uuid",
    "about_type" "public"."about_type" DEFAULT 'none'::"public"."about_type" NOT NULL,
    "about_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "media_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unified_feed" WITH ("security_invoker"='on') AS
 SELECT "p"."id",
    'post'::"text" AS "kind",
    ("p"."content_type")::"text" AS "subtype",
    "p"."author_id",
    "pr"."username",
    "pr"."display_name",
    "pr"."avatar_url",
    "c"."id" AS "creature_id",
    "c"."name" AS "creature_name",
    "c"."slug" AS "creature_slug",
    "c"."avatar_url" AS "creature_avatar",
    "p"."body" AS "title",
    "p"."media_url",
    "p"."created_at",
    ("p"."posting_as_type")::"text" AS "posting_as_type",
    "p"."brand_id",
    "b"."name" AS "brand_name",
    "b"."avatar_url" AS "brand_avatar",
    "b"."slug" AS "brand_slug",
    "p"."updated_at"
   FROM ((("public"."posts" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."author_id")))
     LEFT JOIN "public"."creatures" "c" ON (("c"."id" = "p"."tagged_creature_id")))
     LEFT JOIN "public"."brands" "b" ON (("b"."id" = "p"."brand_id")))
UNION ALL
 SELECT "l"."id",
    'listing'::"text" AS "kind",
    NULL::"text" AS "subtype",
    "l"."seller_id" AS "author_id",
    "pr"."username",
    "pr"."display_name",
    "pr"."avatar_url",
    "c"."id" AS "creature_id",
    "c"."name" AS "creature_name",
    "c"."slug" AS "creature_slug",
    "c"."avatar_url" AS "creature_avatar",
    "l"."title",
    "l"."media_url",
    "l"."created_at",
    ("l"."posting_as_type")::"text" AS "posting_as_type",
    "l"."brand_id",
    "b"."name" AS "brand_name",
    "b"."avatar_url" AS "brand_avatar",
    "b"."slug" AS "brand_slug",
    "l"."updated_at"
   FROM ((("public"."listings" "l"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "l"."seller_id")))
     LEFT JOIN "public"."creatures" "c" ON (("c"."id" = "l"."creature_id")))
     LEFT JOIN "public"."brands" "b" ON (("b"."id" = "l"."brand_id")))
  WHERE ("l"."deleted_at" IS NULL)
UNION ALL
 SELECT "pm"."id",
    'promo'::"text" AS "kind",
    NULL::"text" AS "subtype",
    "pm"."author_id",
    "pr"."username",
    "pr"."display_name",
    "pr"."avatar_url",
    NULL::"uuid" AS "creature_id",
    NULL::"text" AS "creature_name",
    NULL::"text" AS "creature_slug",
    NULL::"text" AS "creature_avatar",
    "pm"."title",
    "pm"."media_url",
    "pm"."created_at",
    'person'::"text" AS "posting_as_type",
    NULL::"uuid" AS "brand_id",
    NULL::"text" AS "brand_name",
    NULL::"text" AS "brand_avatar",
    NULL::"text" AS "brand_slug",
    "pm"."created_at" AS "updated_at"
   FROM ("public"."promos" "pm"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "pm"."author_id")));


ALTER VIEW "public"."unified_feed" OWNER TO "postgres";


ALTER TABLE ONLY "public"."brand_membership_events"
    ADD CONSTRAINT "brand_membership_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_memberships"
    ADD CONSTRAINT "brand_memberships_brand_id_profile_id_key" UNIQUE ("brand_id", "profile_id");



ALTER TABLE ONLY "public"."brand_memberships"
    ADD CONSTRAINT "brand_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_a_user_b_key" UNIQUE ("user_a", "user_b");



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."listing_inquiries"
    ADD CONSTRAINT "listing_inquiries_listing_id_buyer_id_key" UNIQUE ("listing_id", "buyer_id");



ALTER TABLE ONLY "public"."listing_inquiries"
    ADD CONSTRAINT "listing_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."promos"
    ADD CONSTRAINT "promos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_brand_membership_events_brand_created" ON "public"."brand_membership_events" USING "btree" ("brand_id", "created_at" DESC);



CREATE INDEX "idx_brand_memberships_profile_id" ON "public"."brand_memberships" USING "btree" ("profile_id");



CREATE INDEX "idx_brands_owner_id" ON "public"."brands" USING "btree" ("owner_id");



CREATE INDEX "idx_conversations_user_b" ON "public"."conversations" USING "btree" ("user_b");



CREATE INDEX "idx_creatures_owner_id" ON "public"."creatures" USING "btree" ("owner_id");



CREATE INDEX "idx_listing_inquiries_buyer_created" ON "public"."listing_inquiries" USING "btree" ("buyer_id", "created_at" DESC);



CREATE INDEX "idx_listing_inquiries_conversation_created" ON "public"."listing_inquiries" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_listing_inquiries_seller_created" ON "public"."listing_inquiries" USING "btree" ("seller_id", "created_at" DESC);



CREATE INDEX "idx_listings_brand_id" ON "public"."listings" USING "btree" ("brand_id");



CREATE INDEX "idx_listings_creature_id" ON "public"."listings" USING "btree" ("creature_id");



CREATE INDEX "idx_listings_seller_id" ON "public"."listings" USING "btree" ("seller_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_posts_author_id" ON "public"."posts" USING "btree" ("author_id");



CREATE INDEX "idx_posts_brand_id" ON "public"."posts" USING "btree" ("brand_id");



CREATE INDEX "idx_posts_tagged_creature_id" ON "public"."posts" USING "btree" ("tagged_creature_id");



CREATE INDEX "idx_promos_author_id" ON "public"."promos" USING "btree" ("author_id");



CREATE INDEX "messages_conv_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE OR REPLACE TRIGGER "listings_identity_immutable" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_content_identity_immutable"();



CREATE OR REPLACE TRIGGER "listings_touch_updated_at" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "posts_identity_immutable" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_content_identity_immutable"();



CREATE OR REPLACE TRIGGER "posts_touch_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."brand_membership_events"
    ADD CONSTRAINT "brand_membership_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_membership_events"
    ADD CONSTRAINT "brand_membership_events_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_membership_events"
    ADD CONSTRAINT "brand_membership_events_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_memberships"
    ADD CONSTRAINT "brand_memberships_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_memberships"
    ADD CONSTRAINT "brand_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_inquiries"
    ADD CONSTRAINT "listing_inquiries_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_inquiries"
    ADD CONSTRAINT "listing_inquiries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_inquiries"
    ADD CONSTRAINT "listing_inquiries_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listing_inquiries"
    ADD CONSTRAINT "listing_inquiries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_creature_id_fkey" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_tagged_creature_id_fkey" FOREIGN KEY ("tagged_creature_id") REFERENCES "public"."creatures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promos"
    ADD CONSTRAINT "promos_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."brand_membership_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conv participant insert" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "conv participant read" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_b" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inquiry participants read" ON "public"."listing_inquiries" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "buyer_id") OR (( SELECT "auth"."uid"() AS "uid") = "seller_id")));



ALTER TABLE "public"."listing_inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "managers read membership events" ON "public"."brand_membership_events" FOR SELECT TO "authenticated" USING ("public"."is_brand_manager"("brand_id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg participant insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("c"."user_b" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "msg participant read" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user_a" = ( SELECT "auth"."uid"() AS "uid")) OR ("c"."user_b" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "own insert brands" ON "public"."brands" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own insert creatures" ON "public"."creatures" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own insert listings" ON "public"."listings" FOR INSERT TO "authenticated" WITH CHECK ((("seller_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("posting_as_type" = 'person'::"public"."posting_as_type") OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."brand_memberships" "m"
  WHERE (("m"."brand_id" = "listings"."brand_id") AND ("m"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "own insert memberships" ON "public"."brand_memberships" FOR INSERT TO "authenticated" WITH CHECK ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("role" = 'owner'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."brands" "b"
  WHERE (("b"."id" = "brand_memberships"."brand_id") AND ("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "own insert posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("posting_as_type" = 'person'::"public"."posting_as_type") OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."brand_memberships" "m"
  WHERE (("m"."brand_id" = "posts"."brand_id") AND ("m"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "own or managed brand delete posts" ON "public"."posts" FOR DELETE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND "public"."is_brand_manager"("brand_id"))));



CREATE POLICY "own or managed brand update listings" ON "public"."listings" FOR UPDATE TO "authenticated" USING ((("seller_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND "public"."is_brand_manager"("brand_id")))) WITH CHECK ((("seller_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND "public"."is_brand_manager"("brand_id"))));



CREATE POLICY "own or managed brand update posts" ON "public"."posts" FOR UPDATE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND "public"."is_brand_manager"("brand_id")))) WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("posting_as_type" = 'brand'::"public"."posting_as_type") AND ("brand_id" IS NOT NULL) AND "public"."is_brand_manager"("brand_id"))));



CREATE POLICY "own update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read brands" ON "public"."brands" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public read creatures" ON "public"."creatures" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public read listings" ON "public"."listings" FOR SELECT TO "authenticated", "anon" USING (("deleted_at" IS NULL));



CREATE POLICY "public read posts" ON "public"."posts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public read profiles" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public read promos" ON "public"."promos" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "read accessible brand memberships" ON "public"."brand_memberships" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_brand_manager"("brand_id")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_brand_member"("target_brand_id" "uuid", "target_profile_id" "uuid", "target_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_brand_member"("target_brand_id" "uuid", "target_profile_id" "uuid", "target_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_brand_member"("target_brand_id" "uuid", "target_profile_id" "uuid", "target_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."brand_membership_role"("target_brand_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."brand_membership_role"("target_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."brand_membership_role"("target_brand_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."change_brand_member_role"("target_membership_id" "uuid", "target_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_brand_member_role"("target_membership_id" "uuid", "target_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_brand_member_role"("target_membership_id" "uuid", "target_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_content_identity_immutable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_content_identity_immutable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_brand_manager"("target_brand_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_brand_manager"("target_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_brand_manager"("target_brand_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_brand_member"("target_brand_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_brand_member"("target_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_brand_member"("target_brand_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_brand_member"("target_membership_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_brand_member"("target_membership_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_brand_member"("target_membership_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_managed_listing"("target_listing_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_managed_listing"("target_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_managed_listing"("target_listing_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_own_listing"("target_listing_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_own_listing"("target_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_own_listing"("target_listing_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_listing_inquiry"("target_listing_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_listing_inquiry"("target_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_listing_inquiry"("target_listing_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."brand_membership_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."brand_membership_events" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_membership_events" TO "service_role";



GRANT ALL ON TABLE "public"."brand_memberships" TO "anon";
GRANT ALL ON TABLE "public"."brand_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."creatures" TO "anon";
GRANT ALL ON TABLE "public"."creatures" TO "authenticated";
GRANT ALL ON TABLE "public"."creatures" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."listing_inquiries" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."listing_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promos" TO "anon";
GRANT ALL ON TABLE "public"."promos" TO "authenticated";
GRANT ALL ON TABLE "public"."promos" TO "service_role";



GRANT ALL ON TABLE "public"."unified_feed" TO "anon";
GRANT ALL ON TABLE "public"."unified_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_feed" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







