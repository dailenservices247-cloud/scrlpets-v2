# Scrlpets v2 — Slice 2 (Composer: Post + Listing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in users create Posts (text + optional photo) and Listings (title/price/photo, optionally tied to a creature they own — with inline creature creation), and the new content appears in the public unified feed. Riders per gap locks: i18n framework EN+ES (G4-A), axe accessibility tests (G4-A), PostHog product analytics (G6-B).

**Architecture:** Server Actions for writes (validated server-side, author = session user); client uploads media directly to a Supabase Storage bucket then passes the public URL to the action; write RLS so the DB enforces ownership even if the action is bypassed; `revalidatePath("/")` so the feed reflects new content. i18n = `next-intl` without locale routing (default `en`, `es` dictionary, cookie switch later). All new UI consumes Brand House tokens.

**Tech Stack:** Existing slice-1 stack + `next-intl`, `@axe-core/playwright`, `posthog-js`.

**Scope locks (2026-06-11, Dailen veto open):** Reel/video compose, Promo compose (affiliate-gated → shop phase), LongVideo (dormant), real Following ranking = OUT — banked. Repo: `~/dev/scrlpets-v2`, branch `main`, deploy via `npx vercel deploy --prod --yes` (GitHub auto-deploy blocked — see handoff).

---

## PREREQUISITES

- [ ] **P1 — PostHog project key.** Preferred: Dailen creates a `scrlpets-v2` project in the existing PostHog org → `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` into `~/.secret_keys` (`SCRLPETS_V2_POSTHOG_KEY/HOST`). Fallback (acceptable for dev): reuse the legacy key extracted from scrlpets.com's bundle. Non-blocking for Tasks 1–8; gates Task 9 only.
- [ ] **P2 — nothing else.** Storage bucket + policies are created by the engineer via Supabase MCP (Task 1).

---

## FILE STRUCTURE

```
scrlpets-v2/
├── messages/
│   ├── en.json                       # i18n dictionaries (new)
│   └── es.json
├── src/
│   ├── i18n/request.ts               # next-intl request config (new)
│   ├── lib/
│   │   ├── analytics.ts              # posthog client init + capture helper (new)
│   │   ├── media/upload.ts           # client → storage upload helper (new)
│   │   └── compose/
│   │       ├── validation.ts         # pure validators (TDD) (new)
│   │       └── actions.ts            # "use server" createPost/createListing/createCreature (new)
│   ├── app/
│   │   ├── layout.tsx                # + NextIntlClientProvider + PostHog provider (modify)
│   │   ├── page.tsx                  # + compose button for signed-in users (modify)
│   │   └── compose/page.tsx          # auth-gated composer (new)
│   ├── components/compose/
│   │   ├── ComposerTabs.tsx          # Post | Listing switcher (new)
│   │   ├── PostForm.tsx              # (new)
│   │   ├── ListingForm.tsx           # (new)
│   │   ├── CreaturePicker.tsx        # select own creature + inline create (new)
│   │   └── MediaInput.tsx            # file input + upload + preview (new)
│   └── middleware.ts                 # protect /compose (modify)
├── supabase-dev/
│   └── slice2-writes.sql             # bucket + write RLS (new; applied via MCP)
└── tests/
    ├── unit/compose-validation.test.ts   # (new)
    └── e2e/{compose.spec.ts,a11y.spec.ts} # (new)
```

---

## Task 1: Write-side database — storage bucket + insert RLS

**Files:** Create `supabase-dev/slice2-writes.sql`. Apply via Supabase MCP `apply_migration` to project `irpayabloogarxwtjmrf`.

- [ ] **Step 1:** Create `supabase-dev/slice2-writes.sql`:

```sql
-- Slice 2: media bucket + write policies (public read stays per G1-A; writes owner-enforced)

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- uploads land at media/<uid>/<filename>; only the owner can write their folder
create policy "media owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- content writes: author/owner must be the session user
create policy "own insert posts" on public.posts
  for insert to authenticated with check (author_id = auth.uid());

create policy "own insert listings" on public.listings
  for insert to authenticated with check (seller_id = auth.uid());

create policy "own insert creatures" on public.creatures
  for insert to authenticated with check (owner_id = auth.uid());
```

- [ ] **Step 2:** Apply via MCP `apply_migration` (name: `slice2_write_policies`) against `irpayabloogarxwtjmrf`.

- [ ] **Step 3:** Verify via MCP `execute_sql`:

```sql
select polname from pg_policies where schemaname in ('public','storage') and polname like '%insert%' or polname like 'media%';
```
Expected: the 5 new policies listed.

- [ ] **Step 4: Commit**

```bash
git add supabase-dev/slice2-writes.sql && git commit -m "feat: slice-2 write RLS + media bucket (applied via MCP)"
```

---

## Task 2: i18n foundation (next-intl, EN+ES) — G4-A

**Files:** Create `messages/en.json`, `messages/es.json`, `src/i18n/request.ts`; modify `src/app/layout.tsx`, `next.config.ts`.

> Wire-time note: confirm current next-intl App Router setup via context7 (`next-intl` "app router without i18n routing") before wiring — the plugin/request-config API is version-sensitive.

- [ ] **Step 1:** `npm install next-intl`

- [ ] **Step 2:** Create `messages/en.json` (all slice-1 + slice-2 strings; slice-1 chrome gets keys NOW so ES coverage starts complete):

```json
{
  "app": { "title": "Scrlpets", "signIn": "Sign in" },
  "feed": {
    "following": "Following", "forYou": "For You",
    "empty": "Nothing here yet.", "forSale": "For sale",
    "promo": "Promo", "reel": "Reel", "video": "Video"
  },
  "compose": {
    "title": "Create", "tabPost": "Post", "tabListing": "Listing",
    "bodyPlaceholder": "What's happening with your animals?",
    "titlePlaceholder": "Listing title",
    "pricePlaceholder": "Price (USD)",
    "addPhoto": "Add photo", "uploading": "Uploading…",
    "creature": "Creature", "noCreature": "No creature",
    "newCreature": "+ New creature", "creatureName": "Name",
    "creatureSpecies": "Species", "create": "Create",
    "submitPost": "Post", "submitListing": "Publish listing",
    "errorRequired": "Required fields are missing.",
    "errorPrice": "Enter a valid price.",
    "success": "Published!"
  }
}
```

- [ ] **Step 3:** Create `messages/es.json` (same keys, Spanish):

```json
{
  "app": { "title": "Scrlpets", "signIn": "Iniciar sesión" },
  "feed": {
    "following": "Siguiendo", "forYou": "Para ti",
    "empty": "Aún no hay nada.", "forSale": "En venta",
    "promo": "Promo", "reel": "Reel", "video": "Video"
  },
  "compose": {
    "title": "Crear", "tabPost": "Publicación", "tabListing": "Anuncio",
    "bodyPlaceholder": "¿Qué pasa con tus animales?",
    "titlePlaceholder": "Título del anuncio",
    "pricePlaceholder": "Precio (USD)",
    "addPhoto": "Agregar foto", "uploading": "Subiendo…",
    "creature": "Criatura", "noCreature": "Sin criatura",
    "newCreature": "+ Nueva criatura", "creatureName": "Nombre",
    "creatureSpecies": "Especie", "create": "Crear",
    "submitPost": "Publicar", "submitListing": "Publicar anuncio",
    "errorRequired": "Faltan campos obligatorios.",
    "errorPrice": "Ingresa un precio válido.",
    "success": "¡Publicado!"
  }
}
```

- [ ] **Step 4:** Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "en"; // cookie/profile-driven switch = later slice; ES shipped + tested via dictionary parity
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
```

- [ ] **Step 5:** Wire plugin in `next.config.ts`:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6:** In `src/app/layout.tsx`, wrap children:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
```

and inside the body (replacing the bare `<Providers>{children}</Providers>`):

```tsx
const messages = await getMessages();
// component becomes: export default async function RootLayout(...)
<NextIntlClientProvider messages={messages}>
  <Providers>{children}</Providers>
</NextIntlClientProvider>
```

- [ ] **Step 7:** Migrate slice-1 hardcoded strings: in `page.tsx` use `getTranslations` (`t("app.signIn")` etc.), in `FeedTabs.tsx`/tiles use `useTranslations`/`getTranslations` for Following/For You/For sale/Promo/Reel/Video/empty.

- [ ] **Step 8:** Verify: `npm run dev` → UI renders identical English. Flip `request.ts` locale to `"es"` manually → UI renders Spanish → flip back.

- [ ] **Step 9:** Run existing suites — they must stay green (`npx vitest run && npx playwright test`). The E2E asserts on testids, not copy, except role names "Sign in"/"For You" — update specs to use testids/`getByRole("tab")` index if any fail, keeping assertions language-stable.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(i18n): next-intl foundation, EN+ES dictionaries, slice-1 strings migrated (G4-A)"
```

---

## Task 3: Compose validation (TDD — pure functions first)

**Files:** Create `tests/unit/compose-validation.test.ts`, `src/lib/compose/validation.ts`.

- [ ] **Step 1: Write the failing test** `tests/unit/compose-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validatePost, validateListing, parsePriceCents } from "@/lib/compose/validation";

describe("validatePost", () => {
  it("accepts body-only post", () => {
    expect(validatePost({ body: "hi", mediaUrl: null })).toEqual({ ok: true });
  });
  it("accepts photo-only post", () => {
    expect(validatePost({ body: "", mediaUrl: "https://x/y.jpg" })).toEqual({ ok: true });
  });
  it("rejects empty post", () => {
    expect(validatePost({ body: "  ", mediaUrl: null }).ok).toBe(false);
  });
  it("rejects body over 2000 chars", () => {
    expect(validatePost({ body: "a".repeat(2001), mediaUrl: null }).ok).toBe(false);
  });
});

describe("parsePriceCents", () => {
  it("parses dollars to cents", () => expect(parsePriceCents("1500")).toBe(150000));
  it("parses decimals", () => expect(parsePriceCents("12.50")).toBe(1250));
  it("rejects junk", () => expect(parsePriceCents("abc")).toBeNull());
  it("rejects negatives and zero", () => {
    expect(parsePriceCents("-5")).toBeNull();
    expect(parsePriceCents("0")).toBeNull();
  });
});

describe("validateListing", () => {
  it("requires title and positive price", () => {
    expect(validateListing({ title: "Pup", priceCents: 100 }).ok).toBe(true);
    expect(validateListing({ title: " ", priceCents: 100 }).ok).toBe(false);
    expect(validateListing({ title: "Pup", priceCents: 0 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify FAIL** (`npx vitest run tests/unit/compose-validation.test.ts` → module not found).

- [ ] **Step 3: Implement** `src/lib/compose/validation.ts`:

```ts
export type Validation = { ok: true } | { ok: false; error: "required" | "too_long" | "price" };

export function validatePost(input: { body: string; mediaUrl: string | null }): Validation {
  const body = input.body.trim();
  if (!body && !input.mediaUrl) return { ok: false, error: "required" };
  if (body.length > 2000) return { ok: false, error: "too_long" };
  return { ok: true };
}

export function parsePriceCents(raw: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  const cents = Math.round(parseFloat(raw) * 100);
  return cents > 0 ? cents : null;
}

export function validateListing(input: { title: string; priceCents: number | null }): Validation {
  if (!input.title.trim()) return { ok: false, error: "required" };
  if (!input.priceCents || input.priceCents <= 0) return { ok: false, error: "price" };
  return { ok: true };
}
```

- [ ] **Step 4: Run — verify PASS** (all 9).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: compose validation (TDD)"
```

---

## Task 4: Server actions — createPost / createListing / createCreature

**Files:** Create `src/lib/compose/actions.ts`.

- [ ] **Step 1:** `src/lib/compose/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePost, validateListing, parsePriceCents } from "./validation";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

export async function createPost(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "");
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const creatureId = (formData.get("creatureId") as string) || null;
  const v = validatePost({ body, mediaUrl });
  if (!v.ok) return { ok: false, error: v.error };
  const { error } = await supabase.from("posts").insert({
    author_id: user.id, content_type: "post",
    body: body.trim() || null, media_url: mediaUrl, tagged_creature_id: creatureId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createListing(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "");
  const priceCents = parsePriceCents(String(formData.get("price") ?? ""));
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const creatureId = (formData.get("creatureId") as string) || null;
  const v = validateListing({ title, priceCents });
  if (!v.ok) return { ok: false, error: v.error };
  const { error } = await supabase.from("listings").insert({
    seller_id: user.id, title: title.trim(), price_cents: priceCents!,
    media_url: mediaUrl, creature_id: creatureId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createCreature(formData: FormData): Promise<ActionResult & { id?: string }> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const species = String(formData.get("species") ?? "").trim() || null;
  if (!name) return { ok: false, error: "required" };
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 4)}`;
  const { data, error } = await supabase
    .from("creatures")
    .insert({ owner_id: user.id, name, species, slug })
    .select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function getMyCreatures(): Promise<{ id: string; name: string }[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("creatures").select("id,name").eq("owner_id", user.id).order("created_at");
  return data ?? [];
}
```

- [ ] **Step 2:** `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: compose server actions (post/listing/creature, owner-enforced)"
```

---

## Task 5: Media upload helper (client → Supabase Storage)

**Files:** Create `src/lib/media/upload.ts`, `src/components/compose/MediaInput.tsx`.

- [ ] **Step 1:** `src/lib/media/upload.ts`:

```ts
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB photo cap for slice 2
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadPhoto(file: File, userId: string): Promise<{ url: string } | { error: string }> {
  if (!TYPES.includes(file.type)) return { error: "type" };
  if (file.size > MAX_BYTES) return { error: "size" };
  const supabase = createClient();
  const ext = file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl };
}
```

- [ ] **Step 2:** `src/components/compose/MediaInput.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { uploadPhoto } from "@/lib/media/upload";

export function MediaInput({ userId, onUploaded }: { userId: string; onUploaded: (url: string | null) => void }) {
  const t = useTranslations("compose");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    const res = await uploadPhoto(file, userId);
    setBusy(false);
    if ("error" in res) { setErr(res.error); onUploaded(null); return; }
    setPreview(res.url);
    onUploaded(res.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-muted-foreground">
        {busy ? t("uploading") : t("addPhoto")}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handle}
               className="block mt-1 text-sm" data-testid="media-input" disabled={busy} />
      </label>
      {err && <p className="text-destructive text-sm">{err}</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" width={800} height={600}
             className="h-auto w-full max-h-60 rounded-md object-cover" data-testid="media-preview" />
      )}
    </div>
  );
}
```

- [ ] **Step 3:** `npx tsc --noEmit` clean. **Commit:**

```bash
git add -A && git commit -m "feat: photo upload to supabase storage (5MB, jpeg/png/webp)"
```

---

## Task 6: Composer UI — route, tabs, forms, creature picker

**Files:** Create `src/app/compose/page.tsx`, `src/components/compose/{ComposerTabs,PostForm,ListingForm,CreaturePicker}.tsx`; modify `src/middleware.ts`, `src/app/page.tsx`.

- [ ] **Step 1:** Protect `/compose` in `src/middleware.ts` — replace the middleware function body:

```ts
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (user && path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!user && path.startsWith("/compose")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}
```

- [ ] **Step 2:** `src/components/compose/CreaturePicker.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { createCreature } from "@/lib/compose/actions";

type Creature = { id: string; name: string };

export function CreaturePicker({ creatures, value, onChange }:
  { creatures: Creature[]; value: string | null; onChange: (id: string | null) => void }) {
  const t = useTranslations("compose");
  const [list, setList] = useState(creatures);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");

  async function add() {
    const fd = new FormData();
    fd.set("name", name); fd.set("species", species);
    const res = await createCreature(fd);
    if (res.ok && res.id) {
      setList([...list, { id: res.id, name }]);
      onChange(res.id);
      setAdding(false); setName(""); setSpecies("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-muted-foreground">{t("creature")}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
              className="rounded border border-input bg-transparent p-2" data-testid="creature-picker">
        <option value="">{t("noCreature")}</option>
        {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {!adding ? (
        <button type="button" className="text-sm text-brand-link text-left" onClick={() => setAdding(true)}
                data-testid="new-creature">{t("newCreature")}</button>
      ) : (
        <div className="flex gap-2">
          <input className="rounded border border-input bg-transparent p-2 flex-1" placeholder={t("creatureName")}
                 value={name} onChange={(e) => setName(e.target.value)} data-testid="creature-name" />
          <input className="rounded border border-input bg-transparent p-2 flex-1" placeholder={t("creatureSpecies")}
                 value={species} onChange={(e) => setSpecies(e.target.value)} />
          <button type="button" onClick={add} className="rounded bg-secondary px-3 text-sm text-secondary-foreground"
                  data-testid="creature-save">{t("create")}</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3:** `src/components/compose/PostForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPost } from "@/lib/compose/actions";
import { MediaInput } from "./MediaInput";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";

export function PostForm({ userId, creatures }: { userId: string; creatures: { id: string; name: string }[] }) {
  const t = useTranslations("compose");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("body", body);
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    if (creatureId) fd.set("creatureId", creatureId);
    const res = await createPost(fd);
    setBusy(false);
    if (!res.ok) { setErr(t("errorRequired")); return; }
    capture("post_created", { has_media: !!mediaUrl, has_creature: !!creatureId });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="post-form">
      <textarea className="min-h-28 rounded border border-input bg-transparent p-2"
                placeholder={t("bodyPlaceholder")} value={body}
                onChange={(e) => setBody(e.target.value)} data-testid="post-body" />
      <MediaInput userId={userId} onUploaded={setMediaUrl} />
      <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy} data-testid="post-submit">{t("submitPost")}</Button>
    </form>
  );
}
```

- [ ] **Step 4:** `src/components/compose/ListingForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createListing } from "@/lib/compose/actions";
import { MediaInput } from "./MediaInput";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";

export function ListingForm({ userId, creatures }: { userId: string; creatures: { id: string; name: string }[] }) {
  const t = useTranslations("compose");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("title", title); fd.set("price", price);
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    if (creatureId) fd.set("creatureId", creatureId);
    const res = await createListing(fd);
    setBusy(false);
    if (!res.ok) { setErr(res.error === "price" ? t("errorPrice") : t("errorRequired")); return; }
    capture("listing_created", { has_media: !!mediaUrl, has_creature: !!creatureId });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="listing-form">
      <input className="rounded border border-input bg-transparent p-2" placeholder={t("titlePlaceholder")}
             value={title} onChange={(e) => setTitle(e.target.value)} data-testid="listing-title" />
      <input className="rounded border border-input bg-transparent p-2" placeholder={t("pricePlaceholder")}
             inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="listing-price" />
      <MediaInput userId={userId} onUploaded={setMediaUrl} />
      <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy} data-testid="listing-submit">{t("submitListing")}</Button>
    </form>
  );
}
```

- [ ] **Step 5:** `src/components/compose/ComposerTabs.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostForm } from "./PostForm";
import { ListingForm } from "./ListingForm";

export function ComposerTabs({ userId, creatures }: { userId: string; creatures: { id: string; name: string }[] }) {
  const t = useTranslations("compose");
  const [tab, setTab] = useState("post");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="post" className="flex-1">{t("tabPost")}</TabsTrigger>
        <TabsTrigger value="listing" className="flex-1">{t("tabListing")}</TabsTrigger>
      </TabsList>
      <TabsContent value="post"><PostForm userId={userId} creatures={creatures} /></TabsContent>
      <TabsContent value="listing"><ListingForm userId={userId} creatures={creatures} /></TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 6:** `src/app/compose/page.tsx` (RSC; middleware guarantees auth):

```tsx
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getMyCreatures } from "@/lib/compose/actions";
import { ComposerTabs } from "@/components/compose/ComposerTabs";
import Link from "next/link";

export default async function ComposePage() {
  const t = await getTranslations("compose");
  const user = (await getSessionUser())!;
  const creatures = await getMyCreatures();
  return (
    <main className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <Link href="/" className="text-sm text-brand-link underline">←</Link>
      </header>
      <ComposerTabs userId={user.id} creatures={creatures} />
    </main>
  );
}
```

- [ ] **Step 7:** Compose entry point in `src/app/page.tsx` header — next to the title, for signed-in users (replace the `{!user && (...)}` block area):

```tsx
{user ? (
  <Link href="/compose" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
        data-testid="compose-cta">+</Link>
) : (
  <Link href="/login" className="text-sm underline text-brand-link" data-testid="signin-cta">
    {tApp("signIn")}
  </Link>
)}
```

- [ ] **Step 8:** Manual verify: signed out → `/compose` redirects to `/login`; signed in → `+` button → compose post with photo → redirected to `/` → new post first in Following.

- [ ] **Step 9:** `npx tsc --noEmit` + **Commit:**

```bash
git add -A && git commit -m "feat: composer (post + listing) with creature tagging + photo upload"
```

---

## Task 7: PostHog analytics (G6-B)

**Files:** Create `src/lib/analytics.ts`; modify `src/components/Providers.tsx`, `.env.local`, `.env.example`.

- [ ] **Step 1:** `npm install posthog-js`

- [ ] **Step 2:** `src/lib/analytics.ts`:

```ts
"use client";
import posthog from "posthog-js";

let ready = false;

export function initAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || ready || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
  });
  ready = true;
}

export function capture(event: string, props?: Record<string, unknown>) {
  if (ready) posthog.capture(event, props);
}
```

- [ ] **Step 3:** In `src/components/Providers.tsx` add:

```tsx
import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";
// inside Providers component body:
useEffect(() => { initAnalytics(); }, []);
```

- [ ] **Step 4:** Add to `.env.example`: `NEXT_PUBLIC_POSTHOG_KEY=` and `NEXT_PUBLIC_POSTHOG_HOST=`; add real values to `.env.local` + Vercel env (production) when P1 lands. **No key = analytics silently off** — code is safe to ship before P1.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: posthog analytics (no-op without key) + compose events (G6-B)"
```

---

## Task 8: Accessibility tests (axe — G4-A)

**Files:** Create `tests/e2e/a11y.spec.ts`.

- [ ] **Step 1:** `npm install -D @axe-core/playwright`

- [ ] **Step 2:** `tests/e2e/a11y.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSerious(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test("feed has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/");
  await expectNoSerious(page);
});

test("login has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await expectNoSerious(page);
});

test("composer has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/compose");
  await expectNoSerious(page);
});
```

- [ ] **Step 3:** Run `npx playwright test tests/e2e/a11y.spec.ts`. Fix any serious/critical findings at the TOKEN level where color-related (Brand House §3 has pre-verified contrast — failures likely mean a missed token), label/alt fixes inline otherwise. Re-run until green.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: axe wcag2aa gates on feed/login/composer (G4-A)"
```

---

## Task 9: Compose E2E flow

**Files:** Create `tests/e2e/compose.spec.ts`.

- [ ] **Step 1:** `tests/e2e/compose.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("signed-out /compose redirects to login", async ({ page }) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
    await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("create text post → appears at top of feed", async ({ page }) => {
    const marker = `E2E post ${Date.now()}`;
    await page.getByTestId("compose-cta").click();
    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("create listing with price → appears with For sale badge", async ({ page }) => {
    const marker = `E2E listing ${Date.now()}`;
    await page.goto("/compose");
    await page.getByRole("tab", { name: "Listing" }).click();
    await page.getByTestId("listing-title").fill(marker);
    await page.getByTestId("listing-price").fill("123.45");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("listing rejects junk price", async ({ page }) => {
    await page.goto("/compose");
    await page.getByRole("tab", { name: "Listing" }).click();
    await page.getByTestId("listing-title").fill("x");
    await page.getByTestId("listing-price").fill("abc");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL(/compose/);
  });
});
```

- [ ] **Step 2:** Run full suite: `npx vitest run && npx playwright test` → all green (13 unit/9+ E2E expected).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: compose e2e (gate redirect, post flow, listing flow, price validation)"
```

---

## Task 10: Deploy + smoke

- [ ] **Step 1:** `npm run build` green locally.
- [ ] **Step 2:** Push + CLI deploy (GitHub auto-deploy is blocked — see handoff):

```bash
git push origin main && npx vercel deploy --prod --yes
```

- [ ] **Step 3:** Smoke on https://scrlpets-v2.vercel.app: guest feed unchanged; sign in → `+` → publish a post with photo → appears in feed. Delete the smoke post via MCP `execute_sql` if it clutters the demo.
- [ ] **Step 4:** Update `~/.claude/handoffs/scrlpets.md` + relay; sync plan copy to `scrlpets-v2/docs/`.

---

## Self-Review
- **Spec coverage:** composer for Post + Listing (parity step 2, scope-locked subset) T3–T6 ✓ · creature-first tagging + inline create (§0.5 rule 3) T6 ✓ · writes auth-gated, feed stays public (G1-A) T1/T6-S1 ✓ · i18n EN+ES + slice-1 string migration (G4-A) T2 ✓ · axe wcag2aa (G4-A) T8 ✓ · PostHog (G6-B) T7, degrades to no-op without key ✓ · owner-enforced RLS even if actions bypassed T1 ✓ · deploy path honors blocked-GitHub reality T10 ✓.
- **Banked (named):** Reel/video compose → after storage/playback decision (own task) · Promo compose → shop phase · locale SWITCHING (cookie/profile) → ES ships dictionary-complete, switch UI later · edit/delete own content → phase 3 profiles · drafts → demand-driven.
- **Placeholder scan:** none — all steps carry code/commands.
- **Type consistency:** `capture()` import used in T6 forms defined in T7 — execution order note: T7 Step 2 can be pulled earlier or forms temporarily import a stub; SIMPLEST: execute T7 before T6 if linting blocks (both are independent of T6). Validation names match T3↔T4. `getMyCreatures` defined T4, consumed T6.

## Cross-references
- Spec: `AI Hub/PRDs/scrlpets-v2-rebuild-kickoff-design.md` §2.4 step 2 + §2.6 locks
- Slice 1 plan: `scrlpets-v2-slice1-implementation-plan.md` (patterns continued)
- Brand House: `AI Hub/Brand/brand-house-v1.md` (all new UI consumes tokens)
