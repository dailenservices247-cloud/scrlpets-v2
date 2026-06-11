# Scrlpets v2 — Phase 3 (Profiles + Creature Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public profile pages at `/u/[username]` (Posts | Pets | About tabs) and public creature pages at `/c/[slug]` (creature header + their posts/listings); feed tiles link to both; signed-in users edit their own profile (display name, bio, avatar). Seller identity = demo-able surface → fires the vet-partnership planning trigger (Ideas Bank 2026-06-11).

**Architecture:** RSC pages reading the dev DB through small server-side query modules (same pattern as the feed); public read per G1-A (these ARE the SEO/acquisition surfaces); profile edit via server action + owner RLS update policy; avatar reuses the slice-2 `media` bucket + upload helper. All strings through next-intl (EN+ES). Axe gates extended to the new pages.

**Tech Stack:** Existing stack only — no new dependencies.

**Scope locks (2026-06-11):** Breeding tab = OUT (breeder/account-type schema not yet ported to dev DB — banked to BreederOS phase). Username editing = OUT (URL stability; banked). Follow/follower mechanics = OUT (needed for real Following tab — its own block). Creature edit/管理 beyond inline-create = OUT (banked).

---

## FILE STRUCTURE

```
src/
├── lib/profiles/
│   ├── queries.ts          # getProfileByUsername, getCreatureBySlug, content fetchers (new)
│   └── actions.ts          # "use server" updateProfile (new)
├── app/
│   ├── u/[username]/page.tsx     # public profile (new)
│   ├── c/[slug]/page.tsx         # public creature page (new)
│   └── settings/profile/page.tsx # auth-gated edit (new)
├── components/profile/
│   ├── ProfileTabs.tsx     # Posts | Pets | About (client, ?tab= pattern) (new)
│   ├── ProfileHeader.tsx   # avatar/name/username (+Edit link if own) (new)
│   └── ProfileEditForm.tsx # display name, bio, avatar (client) (new)
supabase-dev/phase3-profiles.sql  # bio column + update RLS (new; MCP-applied)
messages/{en,es}.json             # +profile.* keys (modify)
tests/e2e/profiles.spec.ts        # (new)
tests/e2e/a11y.spec.ts            # +2 page gates (modify)
```

---

## Task 1: Schema — bio column + owner update RLS

- [ ] **Step 1:** `supabase-dev/phase3-profiles.sql`:

```sql
alter table public.profiles add column if not exists bio text;

create policy "own update profiles" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
```

- [ ] **Step 2:** Apply via MCP `apply_migration` (name `phase3_profiles`) to `irpayabloogarxwtjmrf`; verify policy via `pg_policies`.
- [ ] **Step 3:** Commit `supabase-dev/phase3-profiles.sql`.

## Task 2: i18n keys (EN+ES)

- [ ] Add to `messages/en.json`:

```json
"profile": {
  "tabPosts": "Posts", "tabPets": "Pets", "tabAbout": "About",
  "noPosts": "No posts yet.", "noPets": "No pets yet.", "noBio": "No bio yet.",
  "edit": "Edit profile", "displayName": "Display name", "bio": "Bio",
  "avatar": "Avatar", "save": "Save", "saved": "Saved",
  "memberSince": "Member since {date}", "notFound": "Not found"
}
```

- [ ] `messages/es.json` mirror: `"tabPosts": "Publicaciones", "tabPets": "Mascotas", "tabAbout": "Acerca de", "noPosts": "Aún no hay publicaciones.", "noPets": "Aún no hay mascotas.", "noBio": "Aún sin biografía.", "edit": "Editar perfil", "displayName": "Nombre", "bio": "Biografía", "avatar": "Avatar", "save": "Guardar", "saved": "Guardado", "memberSince": "Miembro desde {date}", "notFound": "No encontrado"`.
- [ ] Commit.

## Task 3: Query module

- [ ] `src/lib/profiles/queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { rowToFeedItem, type Row } from "@/lib/feed/query";
import type { FeedItem } from "@/lib/feed/types";

export type Profile = {
  id: string; username: string; displayName: string | null;
  avatarUrl: string | null; bio: string | null; createdAt: string;
};

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles").select("id,username,display_name,avatar_url,bio,created_at")
    .eq("username", username).maybeSingle();
  if (!data) return null;
  return {
    id: data.id, username: data.username, displayName: data.display_name,
    avatarUrl: data.avatar_url, bio: data.bio, createdAt: data.created_at,
  };
}

export async function getProfileFeed(authorId: string): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unified_feed").select("*").eq("author_id", authorId)
    .order("created_at", { ascending: false }).limit(50);
  return ((data ?? []) as Row[]).map(rowToFeedItem);
}

export type CreatureProfile = {
  id: string; name: string; species: string | null; slug: string;
  avatarUrl: string | null; owner: { username: string; displayName: string | null };
};

export async function getCreatureBySlug(slug: string): Promise<CreatureProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species,slug,avatar_url,profiles(username,display_name)")
    .eq("slug", slug).maybeSingle();
  if (!data) return null;
  const owner = data.profiles as unknown as { username: string; display_name: string | null };
  return {
    id: data.id, name: data.name, species: data.species, slug: data.slug,
    avatarUrl: data.avatar_url,
    owner: { username: owner.username, displayName: owner.display_name },
  };
}

export async function getCreatureFeed(creatureId: string): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unified_feed").select("*").eq("creature_id", creatureId)
    .order("created_at", { ascending: false }).limit(50);
  return ((data ?? []) as Row[]).map(rowToFeedItem);
}

export async function getCreaturesByOwner(ownerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures").select("id,name,species,slug,avatar_url")
    .eq("owner_id", ownerId).order("created_at");
  return data ?? [];
}
```

- [ ] tsc clean → commit.

## Task 4: updateProfile action

- [ ] `src/lib/profiles/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80) || null;
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 500) || null;
  const avatarUrl = (formData.get("avatarUrl") as string) || undefined;
  const patch: Record<string, unknown> = { display_name: displayName, bio };
  if (avatarUrl) patch.avatar_url = avatarUrl;
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] Commit.

## Task 5: Pages + components

- [ ] `ProfileHeader.tsx` (server): avatar (img or initial), display name, @username, bio under About handled by page; `Edit profile` link if own profile.
- [ ] `ProfileTabs.tsx` (client): same `?tab=` pattern as FeedTabs, values `posts|pets|about`, testids `ptab-*`.
- [ ] `/u/[username]/page.tsx`: 404 via `notFound()` when no profile; tabs render: posts → `FeedList` of `getProfileFeed`; pets → creature link-cards (`/c/[slug]`); about → bio + member-since.
- [ ] `/c/[slug]/page.tsx`: creature header (name/species/owner link) + `FeedList` of `getCreatureFeed`.
- [ ] `/settings/profile/page.tsx` (middleware-gated like /compose): `ProfileEditForm` with displayName/bio inputs + avatar `MediaInput` reuse + save via `updateProfile`.
- [ ] Tiles link-up: author username → `/u/[username]`, creature name → `/c/[slug]` in all 5 tiles; profile header `+` stays.
- [ ] Middleware: gate `/settings`.
- [ ] Manual verify; tsc; commit.

## Task 6: Tests

- [ ] `tests/e2e/profiles.spec.ts`: guest views `/u/breeder_jane` (tabs render, posts visible, pets tab shows Max link) → click creature → `/c/max-c1` shows name + content; unknown username → 404; signed-in edit roundtrip (set bio marker → visible on About). 
- [ ] `a11y.spec.ts`: +`/u/breeder_jane`, +`/c/max-c1` gates.
- [ ] Full suites green; commit.

## Task 7: Deploy + smoke + docs

- [ ] `npm run build` green → push → `npx vercel deploy --prod --yes` → smoke `/u/breeder_jane` + `/c/max-c1` as guest.
- [ ] Update handoff + relay + copy plan to repo docs/.

## Self-Review
- Parity step 3 subset ✓ (role-aware "Breeding" tab explicitly banked — schema not ported). Creature pages = §0.5 creature-first ✓. Public read = G1-A SEO surfaces ✓. i18n + axe riders ✓. Edit limited to display/bio/avatar ✓. No placeholders; types consistent with feed module (reuses `rowToFeedItem`/`Row`/`FeedItem`).
