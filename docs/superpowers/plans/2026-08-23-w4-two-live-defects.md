# W4 — Two Live Defects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the feed from breaking once a viewer's follow or block list outgrows a URL, and give `brands` the archive path every other content table already has.

**Architecture:** Both fixes move work into the database. The feed filter becomes one `security invoker` SQL function that joins `follows` and `blocks` server-side, so no id list ever reaches a query string. `brands` gains `archived_at` and an `archive_brand` definer, mirroring `archive_creature` exactly. Two migrations, two probes, each negative-controlled.

**Tech Stack:** Postgres (security-invoker SQL function, RLS policies, security-definer RPC), Supabase JS client, vitest, `run-probes.sh`.

---

## Background the engineer needs

### Defect 1 — two uncapped id lists in a URL, not one

`src/lib/feed/query.ts:getFeed` builds two PostgREST filters from unbounded arrays:

```ts
// line ~150 — EVERY viewer, BOTH tabs
query = query.not("author_id", "in", `(${blocked.join(",")})`);

// line ~166 — following tab
query = query.in("author_id", [...followed, viewerId]);
```

PostgREST puts both in the query string. A UUID plus its separator is ~37 bytes, so a
16KB request line caps out near 430 ids — and at 8KB, near 210.

**The blocked list is the more dangerous of the two, and the handoff only names the
follow one.** The follow filter is scoped to the Following tab; the block filter runs on
every feed request for every signed-in viewer, on both tabs. Its overflow does not
degrade Following, it breaks the feed entirely.

This class has already bitten this repo once: `a8f35a0` — "The composer stops asking for
409 brands by name" — was the same overflow with brand ids. That is not a coincidence,
which is what Defect 2 is about.

**Fix:** one function, `public.feed_rows`, that does both filters as SQL predicates.
`security invoker` so `unified_feed`'s own RLS keeps applying as the caller —
`security definer` here would quietly hand every viewer the unfiltered feed.

The bootstrap rule stays in TypeScript: below `MIN_FOLLOWING_FOR_FILTER` (3) follows, the
Following tab shows everything so a first-run feed is not near-empty. But it needs a
*count*, not a list — `head: true` with `count: "exact"` sends no ids at all.

Density caps and the For-You hash sort stay in TypeScript. They operate on at most 200
rows and have nothing to do with the URL.

### Defect 2 — `brands` can never be removed

`brands` (baseline `20260720140453`, line 565) has `id, name, brand_type, avatar_url,
owner_id, created_at, slug` — **no `archived_at`, and no DELETE policy anywhere.** Every
brand ever created is permanent and visible forever.

That is what produced the 409-brand composer overflow. Fixture brands accumulate in dev
with nothing able to remove them, and the count only ever rises.

`creatures` already solved exactly this in `20260730073541_capabilities_archive_withdraw`:

```sql
alter table public.creatures add column if not exists archived_at timestamptz;

create or replace function public.archive_creature(target_creature uuid, archived boolean)
...
     set archived_at = case when archived then now() else null end,
         page_visible = case when archived then false else page_visible end

drop policy if exists "public read visible creatures" on public.creatures;
create policy "public read visible creatures" on public.creatures
  ... (page_visible = true and archived_at is null)
```

W4 mirrors that shape for brands. **Archive, not hard delete** — brand slugs are immutable
and brand-attributed content keeps referencing the brand; a DELETE would orphan posts,
listings, memberships and the `brand_content_events` audit spine. The parity ledger calls
immutable attribution a confirmed strength to protect.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_feed_filters_move_into_sql.sql` — **create** | `public.feed_rows(...)`. Joins follows and blocks server-side. |
| `supabase/probes/feed_rows.probe.sql` — **create** | Proves the filters, and proves RLS still applies. |
| `src/lib/social/follows.ts` — **modify** | Add `countFollowing(viewerId)`. Leave `getFollowingIds` — other callers use it. |
| `src/lib/feed/query.ts` — **modify** | `getFeed` calls the RPC. Density caps and hash sort unchanged. |
| `tests/unit/feed-query.test.ts` — **modify or create** | The RPC is called with the right arguments; no id array is ever passed. |
| `supabase/migrations/<ts>_brands_can_be_archived.sql` — **create** | `archived_at`, `archive_brand`, SELECT policy. |
| `supabase/probes/brand_archive.probe.sql` — **create** | Owner/admin only; archived brands vanish from public reads; content survives. |

---

## Task 1: Move the feed filters into SQL

**Files:**
- Create: `supabase/migrations/<timestamp>_feed_filters_move_into_sql.sql`
- Create: `supabase/probes/feed_rows.probe.sql`

- [ ] **Step 1: Confirm the current signature of what you are replacing**

Read these before writing, because the function must reproduce their behaviour exactly:

```bash
sed -n 132,175p src/lib/feed/query.ts
grep -rh -A6 "create or replace function public.blocked_profile_ids" supabase/migrations | head -12
grep -rh -A4 "create or replace view public.unified_feed" supabase/migrations | head -6
```

Note in particular that `unified_feed` is declared `with (security_invoker='on')`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/<timestamp>_feed_filters_move_into_sql.sql` (use a timestamp
later than every existing migration):

```sql
-- The feed stops naming every followed and blocked profile in a URL.
--
-- getFeed built two PostgREST filters from unbounded arrays — `.in(author_id,
-- [...followed])` and `.not(author_id, in, (...blocked))` — and PostgREST puts
-- both in the query string. A UUID plus separator is ~37 bytes, so the request
-- line runs out near 430 ids at 16KB and near 210 at 8KB.
--
-- The BLOCK list is the worse of the two and is the one nobody wrote down: the
-- follow filter only applies to the Following tab, while the block filter runs
-- on every feed request for every signed-in viewer. Its overflow does not
-- degrade Following, it breaks the feed.
--
-- Same failure this repo already shipped once as a8f35a0, "the composer stops
-- asking for 409 brands by name".
--
-- SECURITY INVOKER, deliberately and load-bearingly. `unified_feed` is itself
-- security_invoker, so RLS is evaluated as the caller. A definer here would
-- return every row of the feed to everyone, and it would look like it worked.

create or replace function public.feed_rows(
  following_only boolean default false,
  hide_fixtures boolean default false,
  max_rows integer default 200
)
returns setof public.unified_feed
language sql
stable
security invoker
set search_path = public
as $fn$
  select f.*
    from public.unified_feed f
   where
     -- NULL-safe: `not like` alone is NULL-eliminating and would drop
     -- caption-less media posts from the production feed.
     (not hide_fixtures or f.title is null or f.title not like 'E2E %')
     and not exists (
       select 1 from public.blocked_profile_ids() b
        where b.profile_id = f.author_id
     )
     and (
       not following_only
       or f.author_id = (select auth.uid())
       or exists (
         select 1 from public.follows fo
          where fo.follower_id = (select auth.uid())
            and fo.following_id = f.author_id
       )
     )
   order by f.created_at desc
   limit greatest(1, least(max_rows, 500));
$fn$;

-- Guests read the public feed, so anon keeps execute. RLS on unified_feed is
-- what decides what they actually see, exactly as before this migration.
grant execute on function public.feed_rows(boolean, boolean, integer) to anon, authenticated;
```

- [ ] **Step 3: Write the probe**

Create `supabase/probes/feed_rows.probe.sql`. Read an existing probe first for the exact
harness shape — `supabase/probes/order_thread.probe.sql` is a short one:

```bash
sed -n 1,30p supabase/probes/order_thread.probe.sql
```

The probe must assert, each as its own numbered result line:

1. `following_only := false` returns rows a viewer can see.
2. `following_only := true` returns a followed author's post.
3. `following_only := true` EXCLUDES an unfollowed author's post.
4. `following_only := true` still includes the viewer's OWN post.
5. A blocked author's rows are absent with `following_only` either way.
6. `hide_fixtures := true` drops an `E2E ` titled row but KEEPS a NULL-titled row.
7. `max_rows` caps the result.

Follow the file's own convention of building `results` and raising on failure.

- [ ] **Step 4: Run the probe and confirm it passes**

```bash
bash ./run-probes.sh 2>&1 | tail -6
```

Expected: **22 probes** now, ALL PASS.

- [ ] **Step 5: Invert one assertion and confirm the probe goes RED**

Per `AGENTS.md`: every probe gets one assertion inverted to confirm it goes red before
its green is trusted. Change assertion 3 to expect the unfollowed author's post to be
PRESENT, re-run, confirm `PROBE FAILED`, then revert and re-run.

Record both outputs in the commit message.

- [ ] **Step 6: Commit**

Message states the RED evidence and the GREEN evidence. Do not chain `git commit` behind
the probe run with `&&`.

---

## Task 2: Point the feed at it

**Files:**
- Modify: `src/lib/social/follows.ts`
- Modify: `src/lib/feed/query.ts`
- Test: `tests/unit/feed-query.test.ts`

- [ ] **Step 1: Check what already tests `getFeed`**

```bash
ls tests/unit | grep -i feed
grep -rn "getFeed" tests/unit | head
```

If a feed unit test exists, extend it. If not, create `tests/unit/feed-query.test.ts`.
Either way the new tests must assert the *shape of the call*, since that is the whole
defect: **no array of ids may be passed to Supabase at all.**

- [ ] **Step 2: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The feed stops naming every followed and blocked profile in a URL.
 *
 * These assert the SHAPE of the call, not just its result. The defect was never
 * a wrong answer — it was a correct answer that stops fitting in a request line
 * somewhere past 400 follows, which no test returning rows would ever notice.
 */
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("getFeed", () => {
  it("asks the database to do the filtering, and passes no id list", async () => {
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("for_you", "11111111-1111-1111-1111-111111111111");
    expect(rpc).toHaveBeenCalledWith("feed_rows", expect.any(Object));
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    // The whole point: nothing array-shaped crosses the wire.
    for (const value of Object.values(args)) {
      expect(Array.isArray(value)).toBe(false);
    }
  });

  it("does not turn on the follow filter below the bootstrap threshold", async () => {
    // Under 3 follows the Following tab shows everything, so a first-run feed
    // is never a near-empty page.
    from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ count: 2, error: null }) }),
    });
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("following", "11111111-1111-1111-1111-111111111111");
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: false });
  });

  it("turns it on at the threshold", async () => {
    from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ count: 3, error: null }) }),
    });
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("following", "11111111-1111-1111-1111-111111111111");
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: true });
  });

  it("never turns it on for a guest", async () => {
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("following", null);
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: false });
  });
});
```

Run it and confirm RED before writing the implementation. The exact failure will depend on
the current `getFeed`; read it rather than assuming.

- [ ] **Step 3: Add the count helper**

Append to `src/lib/social/follows.ts`:

```ts
/**
 * How many profiles the viewer follows, without naming any of them.
 *
 * getFollowingIds stays for callers that genuinely need the ids. The feed only
 * needed the COUNT — to decide whether the bootstrap threshold is met — and
 * fetching ids to measure their length is what put 430 UUIDs in a URL.
 */
export async function countFollowing(viewerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("follows")
    .select("following_id", { count: "exact", head: true })
    .eq("follower_id", viewerId);
  return count ?? 0;
}
```

- [ ] **Step 4: Rewrite the query body**

In `src/lib/feed/query.ts`, replace the body of `getFeed` from `const supabase = ...`
through `if (error) throw error;` with:

```ts
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // The bootstrap rule needs a COUNT, not a list. Below the threshold the
  // Following tab shows everything, so a first-run feed is never near-empty.
  let followingOnly = false;
  if (tab === "following" && viewerId) {
    const { countFollowing } = await import("@/lib/social/follows");
    followingOnly = (await countFollowing(viewerId)) >= MIN_FOLLOWING_FOR_FILTER;
  }

  // Both filters now happen in SQL. They used to be built as PostgREST `in`
  // lists, which put every followed and every blocked UUID in the query string
  // and stopped fitting in a request line somewhere past 400 of either.
  const { data, error } = await supabase.rpc("feed_rows", {
    following_only: followingOnly,
    hide_fixtures: hideFixtures(),
    max_rows: hideFixtures() ? 50 : 200,
  });
  if (error) throw error;
```

Leave the two lines after it — the `rowToFeedItem` map, the For-You hash sort and
`applyDensityCaps` — exactly as they are.

- [ ] **Step 5: Verify**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: all green.

- [ ] **Step 6: Prove the id-shape test can fail**

Temporarily add `followed_ids: ["a", "b"]` to the `rpc` argument object. Re-run.

Expected: **"asks the database to do the filtering, and passes no id list"** FAILS.
Revert and re-run.

- [ ] **Step 7: Commit**

---

## Task 3: Brands can be archived

**Files:**
- Create: `supabase/migrations/<timestamp>_brands_can_be_archived.sql`
- Create: `supabase/probes/brand_archive.probe.sql`

- [ ] **Step 1: Read the pattern you are mirroring, completely**

```bash
sed -n 60,135p supabase/migrations/20260730073541_capabilities_archive_withdraw.sql
grep -rhn "on public.brands" supabase/migrations/*.sql | head -20
grep -rh -A8 "create or replace function public.is_brand_manager" supabase/migrations | head -12
```

You must know every existing policy on `brands` before adding one, and the exact
signature of the manager check.

- [ ] **Step 2: Write the migration**

```sql
-- Brands become removable. They never were.
--
-- `brands` has had no DELETE policy and no archived_at since the baseline, so
-- every brand ever created is permanent and publicly visible forever. That is
-- what produced a8f35a0 — the composer naming 409 brands in a URL — because
-- fixture brands accumulate with nothing able to remove them and the count only
-- ever rises.
--
-- ARCHIVE, NOT DELETE, and this is the important part. Brand slugs are
-- immutable, and posts, listings, memberships and the append-only
-- brand_content_events audit spine all reference the brand. A hard delete
-- orphans the evidence; the parity ledger names immutable attribution as a
-- confirmed strength to protect. Same call already made for posts and listings.
--
-- Mirrors archive_creature (20260730073541) rather than inventing a second
-- shape for the same idea.

alter table public.brands
  add column if not exists archived_at timestamptz;

create or replace function public.archive_brand(target_brand uuid, archived boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); b record;
begin
  if uid is null then raise exception 'auth_required'; end if;
  select * into b from public.brands where id = target_brand;
  if b is null then raise exception 'not_found'; end if;
  -- Owner only. Archiving removes the brand's public identity, which is a
  -- stronger act than editing it, and admins can already do everything else.
  if uid <> b.owner_id then raise exception 'not_the_owner'; end if;

  update public.brands
     set archived_at = case when archived then now() else null end
   where id = target_brand;
end; $fn$;

revoke execute on function public.archive_brand(uuid, boolean) from anon, public;
grant execute on function public.archive_brand(uuid, boolean) to authenticated;
```

Then add the SELECT policy. **Read the existing SELECT policy on `brands` first** and
rewrite it to add `archived_at is null`, keeping every other condition it already has.
Do not add a second SELECT policy — Postgres ORs permissive policies together, so a new
one would make archived brands visible rather than hidden.

The owner must still see their own archived brand, or unarchiving is unreachable.

- [ ] **Step 3: Write the probe**

Create `supabase/probes/brand_archive.probe.sql` asserting:

1. A non-owner cannot archive — `not_the_owner`.
2. The owner can archive.
3. An archived brand is absent from an anon read.
4. The owner still sees their own archived brand.
5. Unarchiving restores public visibility.
6. **Posts and listings attributed to the archived brand still exist** — the archive hides
   an identity, it does not delete evidence.

- [ ] **Step 4: Run the probes**

```bash
bash ./run-probes.sh 2>&1 | tail -6
```

Expected: **23 probes**, ALL PASS.

- [ ] **Step 5: Invert one assertion, confirm RED, revert**

Assertion 3 is the one to invert — expect the archived brand to be visible to anon. It
must fail. That assertion is the whole point of the migration.

- [ ] **Step 6: Commit**

---

## Task 4: Full verification sweep

- [ ] **Step 1: Every gate**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
bash ./run-probes.sh
npm run build
npx playwright test --reporter=line
```

Expected: exit 0 · exit 0 · all unit green · **23 probes ALL PASS** · exit 0 ·
**182 passed, 7 skipped** (or 184/5 if the service-role key has since been added).

**Read the counts.** A lower passed-count is a regression that reports itself as success.

The feed change is the highest-risk item in this plan for e2e: many specs assert on feed
contents. If a feed spec fails, the RPC's behaviour differs from the old query — debug the
difference, do not relax the spec.

- [ ] **Step 2: Verify `HEAD`, not the working tree**

```bash
git status --short
git worktree add -q --detach /tmp/w4-headcheck HEAD
ln -s "$PWD/node_modules" /tmp/w4-headcheck/node_modules
(cd /tmp/w4-headcheck && npx tsc --noEmit && npx vitest run)
rm -rf /tmp/w4-headcheck && git worktree prune
```

Remove the worktree from the repo root, never from inside it.

- [ ] **Step 3: Do NOT push the migrations to prod**

These are dev-only until Dailen says otherwise. `run-probes.sh` targets
`irpayabloogarxwtjmrf` (dev). Prod is `qygdixvmxrezhavvnkgc` and is at 102 migrations;
pushing there is a separate, authorized act. Record in the handoff that prod is now behind
by two migrations.

- [ ] **Step 4: Record results in this file and commit**

---

## Self-review notes

**Spec coverage.** The design's W4 names the follow-list cap and the brands archive plus
DELETE policy. Tasks 1–2 cover the first and additionally the block-list overflow the
design did not name; Task 3 covers the second as an archive rather than a DELETE, for the
reason stated in the migration comment.

**A deliberate divergence.** The design said "cap the list and fall back to a join or an
RPC once the follow graph exceeds what a URL can carry." This plan skips the cap. A cap
means a viewer past the threshold silently stops seeing content from some of the people
they follow — a wrong feed that reports no error, which is worse than the failure it
replaces. The RPC has no threshold to exceed, so there is nothing to fall back from.

**A deliberate divergence, second.** The design said "DELETE policy". This plan implements
archive instead. A DELETE on `brands` orphans posts, listings, memberships and the
append-only `brand_content_events` audit spine, and immutable attribution is a strength
the parity ledger explicitly protects. If a true hard delete is wanted it needs its own
decision about what happens to that content, which is a product question and not this
plan's to answer.

**Highest risk.** `security invoker` on `feed_rows`. Getting it wrong — writing `security
definer`, as most RPCs in this codebase correctly are — returns the entire feed to every
caller including guests, and every existing test would still pass because they assert on
rows being present rather than absent. Probe assertion 5 (blocked authors absent) and the
existing feed e2e specs are the guard. Read the `security invoker` line twice.

**Type consistency.** `countFollowing` is new; `getFollowingIds` is untouched and still
used elsewhere — check its other callers before assuming it is dead.
