# Visual System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation layer of the visual system — display serif, type scale, spacing rhythm, and the editorial/panel surface registers — and prove it by rebuilding the feed tiles on top of it.

**Architecture:** Tokens land in `globals.css` under Tailwind v4's `@theme inline`, so every size and face is a utility (`text-body`, `font-serif`) instead of a raw pixel value. `FeedCardShell` gains a `register` prop that decides whether a tile is an unboxed editorial item or a panel object; each tile passes its register. The dev-only `/design` harness is the surface every visual test measures, because its content never moves.

**Tech Stack:** Next 16.2.9 (App Router, Turbopack), Tailwind CSS 4.3, Base UI 1.5, next/font/google, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-09-15-visual-system-design.md`

**Not in this plan:**
- Tile→realm view-transition morphs (spec §5) and the motion rules (§6) — nothing to attach them to until the registers exist.
- Listing price/status pills (spec §3.3, Panel) — `FeedItem` carries no price or status field, so surfacing them is a feed-data change, not a skin change. It needs its own plan and its own review.
- The immersive register (§3.3) and the 4:5 portrait cap (§3.4) — the reel tile already speaks that language as of F6 (`4ee7ed8`); it gets revisited with the morph work, not before.

**One caution:** these are the repo's first `toHaveScreenshot` baselines. Font rasterization differs across machines, so a baseline generated here is only authoritative here. `ship-verify.sh` runs locally, which is why this is safe today — if the suite ever moves to hosted CI, regenerate baselines there or the visual tests will fail for a reason that has nothing to do with the design.

---

### Task 1: Make the design harness reachable in the test environment

The e2e suite runs `npm run build && npm run start` (playwright.config.ts), so `process.env.NODE_ENV` is `"production"` there and today's gate would return `notFound()` — every visual test in this plan would measure a 404. The suite already has this exact pattern for `E2E_KEEP_FIXTURES`. A flag and its inverse are both invisible while the flag is off, so the decision gets extracted into a pure function and tested on both branches.

**Files:**
- Create: `src/lib/design/harness.ts`
- Create: `tests/unit/design-harness.test.ts`
- Modify: `src/app/design/page.tsx:53` (the `notFound()` gate)
- Modify: `playwright.config.ts:webServer.env`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/design-harness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { designHarnessEnabled } from "@/lib/design/harness";

describe("designHarnessEnabled", () => {
  it("is on when the flag is set, even in a production build", () => {
    expect(designHarnessEnabled({ NODE_ENV: "production", DESIGN_HARNESS: "1" })).toBe(true);
  });

  it("is on in development without the flag", () => {
    expect(designHarnessEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is OFF in a production build with no flag — this is what protects scrlpets.com", () => {
    expect(designHarnessEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("treats any value other than 1 as off", () => {
    expect(designHarnessEnabled({ NODE_ENV: "production", DESIGN_HARNESS: "true" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-harness.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/design/harness"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/design/harness.ts`:

```ts
/**
 * The design harness renders fixture content that must never be reachable on
 * scrlpets.com. The e2e suite runs a PRODUCTION build, so NODE_ENV alone would
 * hide the harness from the very tests that measure it — hence an explicit
 * opt-in flag, the same shape as E2E_KEEP_FIXTURES.
 *
 * Pure function on purpose: a gate and its inverse are both inert while the
 * flag is off, so the only way to prove both branches is to test the decision
 * itself.
 */
export function designHarnessEnabled(env: {
  NODE_ENV?: string;
  DESIGN_HARNESS?: string;
}): boolean {
  if (env.DESIGN_HARNESS === "1") return true;
  return env.NODE_ENV !== "production";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/design-harness.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Use it in the page**

In `src/app/design/page.tsx`, replace the import line and the gate:

```tsx
import { notFound } from "next/navigation";
import { designHarnessEnabled } from "@/lib/design/harness";
```

```tsx
  if (!designHarnessEnabled(process.env)) notFound();
```

- [ ] **Step 6: Let the e2e server serve it**

In `playwright.config.ts`, inside `webServer.env`, add one line after `E2E_KEEP_FIXTURES: "1",`:

```ts
      // The visual specs measure the design harness, which is off by default in
      // a production build (src/lib/design/harness.ts).
      DESIGN_HARNESS: "1",
```

- [ ] **Step 7: Verify the whole unit suite still passes**

Run: `npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/lib/design/harness.ts tests/unit/design-harness.test.ts src/app/design/page.tsx playwright.config.ts
git commit -m "Design harness opts in by flag, so the prod-build e2e run can see it"
```

---

### Task 2: Display serif and the type scale

**Files:**
- Modify: `src/app/layout.tsx:2,7-15,32`
- Modify: `src/app/globals.css:6-9` (inside `@theme inline`)
- Create: `tests/unit/type-scale.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/type-scale.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("type scale tokens", () => {
  it.each(["display", "title", "body", "ui", "meta"])(
    "defines --text-%s so it can be used as a utility",
    (role) => {
      expect(css).toContain(`--text-${role}:`);
    },
  );

  it("maps a serif family token", () => {
    expect(css).toContain("--font-serif:");
  });

  it("loads the display serif and exposes it as a CSS variable", () => {
    expect(layout).toContain("Instrument_Serif");
    expect(layout).toContain("--font-instrument-serif");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/type-scale.test.ts`
Expected: FAIL — 7 failures, none of the tokens exist yet.

- [ ] **Step 3: Load the font**

In `src/app/layout.tsx`, change the font import line to:

```tsx
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
```

Add after the `geistMono` declaration:

```tsx
// Identity only — brand names, animal names, realm headings (Brand House §2.3,
// amended 2026-09-15). One weight is all the face ships, and all it needs:
// anything that wants a second weight is UI text and belongs in Geist.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
```

Add the variable to the `<html>` className:

```tsx
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} dark h-full antialiased`}
```

- [ ] **Step 4: Add the scale**

In `src/app/globals.css`, inside the `@theme inline { … }` block, immediately after the `--font-mono` / `--font-heading` lines, add:

```css
  --font-serif: var(--font-instrument-serif), Georgia, serif;

  /* One scale, used everywhere. Raw text-[Npx] is guarded against in
     tests/unit/type-scale.test.ts — add a role here instead of inventing one. */
  --text-display: 24px;
  --text-display--line-height: 1.15;
  --text-display--letter-spacing: -0.02em;
  --text-title: 19px;
  --text-title--line-height: 1.25;
  --text-title--letter-spacing: -0.015em;
  --text-body: 17px;
  --text-body--line-height: 1.5;
  --text-body--letter-spacing: -0.011em;
  --text-ui: 15px;
  --text-ui--line-height: 1.4;
  --text-meta: 13px;
  --text-meta--line-height: 1.35;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/type-scale.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Verify the utilities actually compile**

Run: `npm run build`
Expected: build completes with no CSS errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css tests/unit/type-scale.test.ts
git commit -m "One type scale, and a display serif that only identity may use"
```

---

### Task 3: Identity renders in the serif — and nothing else does

**Files:**
- Modify: `src/components/feed/AttributionStack.tsx:63,96` (the two name links), `:15` (avatar sizing stays)
- Create: `tests/e2e/design-system.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/design-system.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

/**
 * Measured against /design, never the real feed: fixture content never moves,
 * so a failure here is a design regression and not someone posting.
 */
const fontOf = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((el) => getComputedStyle(el).fontFamily);

test.describe("identity typography", () => {
  test("a brand name renders in the display serif", async ({ page }) => {
    await page.goto("/design");
    const brand = page.getByTestId("brand-attribution").first();
    await expect(brand).toBeVisible();
    expect(await fontOf(brand)).toContain("Instrument");
  });

  test("the timestamp beside it does NOT — the serif is identity only", async ({ page }) => {
    await page.goto("/design");
    const time = page.getByTestId("post-permalink").first();
    await expect(time).toBeVisible();
    expect(await fontOf(time)).not.toContain("Instrument");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: FAIL on the first test — the computed family is Geist, not Instrument. The second test passes already; it is there to stay passing.

- [ ] **Step 3: Apply the serif to the two identity slots**

In `src/components/feed/AttributionStack.tsx`, the brand-name link (currently `className="block max-w-full truncate text-[15px] font-semibold leading-tight text-foreground transition hover:text-brand-link hover:underline"`) becomes:

```tsx
            className="block max-w-full truncate font-serif text-title leading-tight text-foreground transition hover:text-brand-link hover:underline"
```

The person-name link in the non-brand branch (same raw classes) becomes:

```tsx
          className="block max-w-full truncate font-serif text-title leading-tight text-foreground transition hover:text-brand-link hover:underline"
```

Note both lose `font-semibold`: the face ships one weight, and asking for 600 would synthesize a fake bold.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: PASS, 2 tests.

- [ ] **Step 5: Guard the file against raw sizes and colors**

Append to `tests/unit/type-scale.test.ts`:

```ts
const GUARDED = ["src/components/feed/AttributionStack.tsx"];

describe("feed components use the scale, not raw values", () => {
  it.each(GUARDED)("%s has no raw pixel font size", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/text-\[\d+(\.\d+)?px\]/);
  });

  it.each(GUARDED)("%s has no color literal", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(/);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run tests/unit/type-scale.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/feed/AttributionStack.tsx tests/e2e/design-system.spec.ts tests/unit/type-scale.test.ts
git commit -m "Brand and animal names carry the serif; the timestamp beside them does not"
```

---

### Task 4: The editorial register — posts stop being boxes

**Files:**
- Modify: `src/components/feed/FeedCardShell.tsx:20-38` (add the `register` prop and the unboxed branch)
- Modify: `src/components/feed/tiles/PostTile.tsx:25,29`
- Modify: `src/components/feed/TileMedia.tsx:44-54` (the `<img>` branch)
- Modify: `tests/e2e/design-system.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/design-system.spec.ts`:

```ts
test.describe("editorial register", () => {
  test("post body copy is at least 16px", async ({ page }) => {
    await page.goto("/design");
    const body = page.getByTestId("post-body").first();
    await expect(body).toBeVisible();
    const size = await body.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test("a post tile has no card border — the box is gone", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-post").first();
    await expect(tile).toBeVisible();
    const width = await tile.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(width)).toBe(0);
  });

  test("a listing tile still has one — the panel register survives", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-listing").first();
    await expect(tile).toBeVisible();
    const width = await tile.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(width)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: FAIL — `post-body` does not exist, and the post tile has a border. The listing test passes already.

- [ ] **Step 3: Give the shell two registers**

In `src/components/feed/FeedCardShell.tsx`, replace the `shellStyles` constant and the component signature/return with:

```tsx
const accentByType: Record<FeedItem["type"], string> = {
  post: "",
  reel: "border-[color:var(--brand-wine-bright)]",
  long_video: "border-secondary/45",
  listing: "border-primary/60",
  promo: "border-accent/45",
};

export function FeedCardShell({
  item,
  children,
  className,
  canManage = false,
  register = "panel",
}: {
  item: FeedItem;
  children: ReactNode;
  className?: string;
  canManage?: boolean;
  /** editorial = something a person said; panel = something carrying state. */
  register?: "editorial" | "panel";
}) {
  const t = useTranslations("content");
  const edited =
    new Date(item.updatedAt).getTime() > new Date(item.createdAt).getTime();

  const header = (
    <header className="flex items-start justify-between gap-3">
      <AttributionStack item={item} className="flex-1" />
      <div className="flex items-center gap-1.5">
        {item.group && (
          <Link
            href={`/groups/${item.group.slug}`}
            aria-label={t("inGroup", { group: item.group.name })}
            data-testid="group-chip"
            className="max-w-40 truncate rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/20"
          >
            {item.group.name}
          </Link>
        )}
        {item.pinnedAt && (
          <span
            className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-link"
            data-testid="pinned-chip"
          >
            {t("pinnedToProfile")}
          </span>
        )}
        {edited && (
          <span
            className="rounded-full border border-border/70 bg-muted/45 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            data-testid="edited-chip"
          >
            {t("edited")}
          </span>
        )}
        {item.type !== "post" && <ContentTypeBadge type={item.type} />}
        {canManage && <ContentOwnerActions item={item} />}
      </div>
    </header>
  );

  // Editorial items are not objects on a surface — they are entries in a
  // column. No border, no fill, no shadow; the rhythm in FeedList separates
  // them instead.
  if (register === "editorial") {
    return (
      <article
        className={cn("flex flex-col gap-3 px-1", className)}
        data-testid={`tile-${item.type}`}
      >
        {header}
        {children}
      </article>
    );
  }

  return (
    <Card
      className={cn("premium-panel gap-3 rounded-2xl p-4", accentByType[item.type], className)}
      data-testid={`tile-${item.type}`}
    >
      {header}
      {children}
    </Card>
  );
}
```

- [ ] **Step 4: Put PostTile in the editorial register**

In `src/components/feed/tiles/PostTile.tsx`, change the opening shell tag and the body paragraph:

```tsx
    <FeedCardShell item={item} canManage={canManage} register="editorial">
      {item.title && (
        <p className="whitespace-pre-wrap text-body" data-testid="post-body">
          {item.title}
        </p>
      )}
```

- [ ] **Step 5: Let media run edge to edge and keep its own shape**

In `src/components/feed/TileMedia.tsx`, replace the final `<img>` return with:

```tsx
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={800}
      height={600}
      loading="lazy"
      className={
        variant === "feed"
          ? // Native aspect, and wider than the text column: the photo is the
            // point of most posts. No forced 4:3 crop, no ring drawing a box
            // around something that no longer sits in one.
            "-mx-4 mt-1 h-auto w-[calc(100%+2rem)] max-w-none object-cover"
          : "mt-1 h-auto w-full rounded-xl object-cover"
      }
      data-testid="tile-media"
    />
  );
```

- [ ] **Step 6: Run the visual specs**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: PASS, 5 tests.

- [ ] **Step 7: Prove nothing else broke — the feed suite binds to these testids**

Run: `npx playwright test tests/e2e/feed.spec.ts --workers=1`
Expected: PASS. If a selector fails, it is asserting on the old box and needs its assertion moved to the new structure — fix the spec, not the register.

- [ ] **Step 8: Commit**

```bash
git add src/components/feed/FeedCardShell.tsx src/components/feed/tiles/PostTile.tsx src/components/feed/TileMedia.tsx tests/e2e/design-system.spec.ts
git commit -m "Posts become entries in a column, not objects on a surface"
```

---

### Task 5: The panel register earns its border

**Files:**
- Modify: `src/components/feed/tiles/ListingTile.tsx:10-16`
- Modify: `src/components/feed/tiles/PromoTile.tsx:13`
- Modify: `src/components/feed/tiles/LongVideoTile.tsx:12`
- Modify: `tests/unit/type-scale.test.ts` (extend `GUARDED`)

- [ ] **Step 1: Extend the guard to the tiles about to change**

In `tests/unit/type-scale.test.ts`, change the `GUARDED` array to:

```ts
const GUARDED = [
  "src/components/feed/AttributionStack.tsx",
  "src/components/feed/tiles/ListingTile.tsx",
  "src/components/feed/tiles/PromoTile.tsx",
  "src/components/feed/tiles/LongVideoTile.tsx",
];
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/type-scale.test.ts`
Expected: FAIL — ListingTile and PromoTile both carry `text-[17px]`.

- [ ] **Step 3: Convert the tiles to the scale**

In `src/components/feed/tiles/ListingTile.tsx`, the summary block becomes:

```tsx
      <div className="rounded-xl border border-primary/25 bg-background/45 p-3.5 shadow-inner" data-testid="listing-summary">
        <p className="eyebrow">{t("listingIntent")}</p>
        <p className="mt-1 font-serif text-title leading-snug">{item.title}</p>
        <p className="mt-1 text-meta text-muted-foreground">{t("listingContext")}</p>
      </div>
```

In `src/components/feed/tiles/PromoTile.tsx`, the title line becomes:

```tsx
        <p className="mt-1 text-title font-semibold leading-snug">{item.title}</p>
```

Note: promo titles are copy, not identity, so they stay in Geist and keep their weight.

In `src/components/feed/tiles/LongVideoTile.tsx`, the title line becomes:

```tsx
      <p className="text-title font-medium leading-snug">{item.title}</p>
```

- [ ] **Step 4: Run the guard again**

Run: `npx vitest run tests/unit/type-scale.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Confirm the panel register still reads as a panel**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: PASS, 5 tests — including "a listing tile still has one".

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/tiles/ListingTile.tsx src/components/feed/tiles/PromoTile.tsx src/components/feed/tiles/LongVideoTile.tsx tests/unit/type-scale.test.ts
git commit -m "Panel tiles move onto the scale; the listing title takes the serif"
```

---

### Task 6: Rhythm and column width

**Files:**
- Modify: `src/components/feed/FeedList.tsx:82` (the list container)
- Modify: `src/components/app/AppPage.tsx:36` (the column cap)
- Modify: `src/app/design/page.tsx` (mirror both, so the harness keeps measuring the real thing)

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/design-system.spec.ts`:

```ts
test.describe("rhythm", () => {
  test("posts are separated by 20px of rhythm, not 16", async ({ page }) => {
    await page.goto("/design");
    const list = page.getByTestId("design-harness").locator(":scope > div").first();
    const gap = await list.evaluate((el) => getComputedStyle(el).rowGap);
    expect(parseFloat(gap)).toBe(20);
  });

  test("the reading column is 720px at desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/design");
    const column = page.getByTestId("design-harness").locator("xpath=..");
    const width = await column.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(700);
    expect(width).toBeLessThanOrEqual(720);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: FAIL — gap is 16px, column is 672px.

- [ ] **Step 3: Widen the column and open the rhythm**

In `src/components/app/AppPage.tsx`, the shell div becomes:

```tsx
      <div className="app-surface flex min-h-dvh w-full min-w-0 flex-col lg:max-w-[720px] lg:border-x lg:border-border/60">
```

In `src/components/feed/FeedList.tsx`, the list container becomes:

```tsx
      <div className="flex flex-col gap-5" data-testid="feed-list">
```

In `src/app/design/page.tsx`, apply both to the mirrored shell and list:

```tsx
      <div className="app-surface flex min-h-dvh w-full min-w-0 flex-col lg:max-w-[720px] lg:border-x lg:border-border/60">
```

```tsx
          <div className="flex flex-col gap-5">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/AppPage.tsx src/components/feed/FeedList.tsx src/app/design/page.tsx tests/e2e/design-system.spec.ts
git commit -m "A wider reading column and 20px between entries"
```

---

### Task 7: Lock it down with baselines and an accessibility pass

**Files:**
- Modify: `tests/e2e/design-system.spec.ts`

- [ ] **Step 1: Add the screenshot baselines and the axe check**

First add the axe import at the TOP of `tests/e2e/design-system.spec.ts`, as line 2 — the
same position every other spec uses (`tests/e2e/a11y.spec.ts:2`):

```ts
import AxeBuilder from "@axe-core/playwright";
```

Then append the rest to the bottom of the file:

```ts
test.describe("baselines", () => {
  // Fixture content is fixed, so a diff here means the design moved — which is
  // the only reason a screenshot test is worth its flake budget.
  test("phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design");
    await page.getByTestId("tile-promo").waitFor();
    await expect(page).toHaveScreenshot("feed-390.png", { maxDiffPixelRatio: 0.02, fullPage: true });
  });

  test("desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/design");
    await page.getByTestId("tile-promo").waitFor();
    await expect(page).toHaveScreenshot("feed-1440.png", { maxDiffPixelRatio: 0.02, fullPage: true });
  });

  test("no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/design");
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Generate the baselines**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1 --update-snapshots`
Expected: two PNGs written under `tests/e2e/design-system.spec.ts-snapshots/`.

- [ ] **Step 3: Run without updating, to prove they are stable**

Run: `npx playwright test tests/e2e/design-system.spec.ts --workers=1`
Expected: PASS, 10 tests. A failure here means the page is not deterministic — fix that before trusting any later diff.

- [ ] **Step 4: Full verification**

Run: `./ship-verify.sh`
Expected: read the SUMMARY block's RESULT line, not the exit code. All gates pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/design-system.spec.ts tests/e2e/design-system.spec.ts-snapshots
git commit -m "Baselines at phone and desktop width, and an axe gate on the harness"
```

---

## Acceptance

Against spec §8, this plan covers criteria 1–4 (scale tokens and the guard test), 7 (axe), 8 (contrast is unchanged — `ink-muted-card` already carries the AA amendment), 9 (baselines) and 10 (no new runtime dependency — `next/font/google` and `@axe-core/playwright` are both already installed).

Criteria 5 and 6 — view-transition names and reduced-motion behavior — belong to the morph plan, which has nothing to attach to until these registers exist.
