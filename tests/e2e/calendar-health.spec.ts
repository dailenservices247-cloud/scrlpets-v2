import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, signInCached } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(email: string) {
  return signInCached(email);
}

test("signed-out /calendar redirects to login", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login/);
});

test("signed-out /health redirects to login", async ({ page }) => {
  await page.goto("/health");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("signed in", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
  });

  test("log a mating event via UI shows the DB-computed due date", async ({ page }) => {
    test.setTimeout(120_000);
    const { db, userId } = await signIn(SELLER_EMAIL);
    const stamp = Date.now();
    const sireName = `E2E Sire ${stamp}`;
    const damName = `E2E Dam ${stamp}`;

    const sire = await db
      .from("creatures")
      .insert({ owner_id: userId, name: sireName, slug: `e2e-sire-${stamp}`, species: "Dog" })
      .select("id")
      .single();
    expect(sire.error).toBeNull();
    const dam = await db
      .from("creatures")
      .insert({ owner_id: userId, name: damName, slug: `e2e-dam-${stamp}`, species: "Dog" })
      .select("id")
      .single();
    expect(dam.error).toBeNull();

    await page.goto("/calendar");
    await page.getByTestId("log-event-cta").click();
    await expect(page.getByTestId("event-sheet")).toBeVisible();
    await page.getByTestId("event-type-mating").click();
    await page.getByTestId("event-creature").selectOption({ label: sireName });
    await page.getByTestId("event-partner").selectOption({ label: damName });
    const eventDate = new Date().toISOString().slice(0, 10);
    await page.getByTestId("event-date").fill(eventDate);
    await page.getByTestId("event-save").click();

    // The trigger computes expected_due_date server-side (event_date + the
    // dog's species_gestation.gestation_days = 63) — never derived here.
    await expect(page.getByTestId("event-due-date")).toBeVisible({ timeout: 15_000 });
    const dueDateText = (await page.getByTestId("event-due-date").textContent()) ?? "";
    const expectedDue = new Date(`${eventDate}T00:00:00Z`);
    expectedDue.setUTCDate(expectedDue.getUTCDate() + 63);
    const expectedLabel = expectedDue.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(dueDateText).toContain(expectedLabel);
    await page.getByTestId("event-success-close").click();

    // Cleanup — asserted.
    const delEvents = await db
      .from("breeding_events")
      .delete({ count: "exact" })
      .eq("creature_id", sire.data!.id);
    expect(delEvents.count).toBe(1);
    const hideSire = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("id", sire.data!.id);
    expect(hideSire.count).toBe(1);
    const hideDam = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("id", dam.data!.id);
    expect(hideDam.count).toBe(1);
  });

  test("completing a monthly reminder creates the next occurrence one month later", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { db, userId } = await signIn(SELLER_EMAIL);
    const stamp = Date.now();
    const animalName = `E2E Health Animal ${stamp}`;
    const title = `E2E Monthly Reminder ${stamp}`;
    const dueDate = new Date().toISOString().slice(0, 10);

    const animal = await db
      .from("creatures")
      .insert({ owner_id: userId, name: animalName, slug: `e2e-health-${stamp}`, species: "Dog" })
      .select("id")
      .single();
    expect(animal.error).toBeNull();

    await page.goto("/health");
    await page.getByTestId("add-reminder-cta").click();
    await expect(page.getByTestId("reminder-sheet")).toBeVisible();
    await page.getByTestId("reminder-type-vaccination").click();
    await page.getByTestId("reminder-title").fill(title);
    await page.getByTestId("reminder-creature").selectOption({ label: animalName });
    await page.getByTestId("reminder-due-date").fill(dueDate);
    await page.getByTestId("reminder-repeat").selectOption("monthly");
    await page.getByTestId("reminder-save").click();
    await expect(page.getByTestId("reminder-sheet")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

    const created = await db
      .from("health_reminders")
      .select("id,due_date")
      .eq("profile_id", userId)
      .eq("title", title)
      .is("completed_at", null)
      .single();
    expect(created.error).toBeNull();
    const createdId = created.data!.id;

    await page.getByTestId(`reminder-checkbox-${createdId}`).click();
    await expect(page.getByTestId(`reminder-item-${createdId}`)).toHaveCount(0, { timeout: 15_000 });

    // THE recurrence acceptance: completing a repeat!=none reminder must
    // insert the next occurrence server-side — refetch and assert it exists.
    const next = await db
      .from("health_reminders")
      .select("id,due_date,repeat_interval")
      .eq("profile_id", userId)
      .eq("title", title)
      .is("completed_at", null)
      .single();
    expect(next.error).toBeNull();
    expect(next.data!.id).not.toBe(createdId);
    expect(next.data!.repeat_interval).toBe("monthly");
    const expectedNextDue = new Date(`${created.data!.due_date}T00:00:00Z`);
    expectedNextDue.setUTCMonth(expectedNextDue.getUTCMonth() + 1);
    expect(next.data!.due_date).toBe(expectedNextDue.toISOString().slice(0, 10));

    await expect(page.getByTestId(`reminder-item-${next.data!.id}`)).toBeVisible({ timeout: 15_000 });

    // Cleanup — asserted. Both the completed original and the spawned next
    // occurrence share this marker title, so exactly two rows match.
    const delReminders = await db
      .from("health_reminders")
      .delete({ count: "exact" })
      .eq("profile_id", userId)
      .eq("title", title);
    expect(delReminders.count).toBe(2);
    const hideAnimal = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("id", animal.data!.id);
    expect(hideAnimal.count).toBe(1);
  });

  test("animal filter narrows the reminder list and the stats", async ({ page }) => {
    test.setTimeout(120_000);
    const { db, userId } = await signIn(SELLER_EMAIL);
    const stamp = Date.now();
    const nameA = `E2E Filter A ${stamp}`;
    const nameB = `E2E Filter B ${stamp}`;
    const titleA = `E2E Filter Reminder A ${stamp}`;
    const titleB = `E2E Filter Reminder B ${stamp}`;
    const dueDate = new Date().toISOString().slice(0, 10);

    const animalA = await db
      .from("creatures")
      .insert({ owner_id: userId, name: nameA, slug: `e2e-filter-a-${stamp}`, species: "Dog" })
      .select("id")
      .single();
    expect(animalA.error).toBeNull();
    const animalB = await db
      .from("creatures")
      .insert({ owner_id: userId, name: nameB, slug: `e2e-filter-b-${stamp}`, species: "Dog" })
      .select("id")
      .single();
    expect(animalB.error).toBeNull();

    await page.goto("/health");

    async function addReminder(title: string, animalName: string) {
      await page.getByTestId("add-reminder-cta").click();
      await expect(page.getByTestId("reminder-sheet")).toBeVisible();
      await page.getByTestId("reminder-type-grooming").click();
      await page.getByTestId("reminder-title").fill(title);
      await page.getByTestId("reminder-creature").selectOption({ label: animalName });
      await page.getByTestId("reminder-due-date").fill(dueDate);
      await page.getByTestId("reminder-save").click();
      await expect(page.getByTestId("reminder-sheet")).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    }

    await addReminder(titleA, nameA);
    await addReminder(titleB, nameB);

    const statsBefore = Number.parseInt(
      (await page.getByTestId("stat-this-week-count").textContent()) ?? "0",
      10,
    );

    // Filtering to animal A must narrow the MAIN LIST too — legacy's filter
    // narrowed the calendar/stats but left the list showing every animal.
    await page.getByTestId("health-animal-filter").selectOption({ label: nameA });
    await expect(page.getByText(titleA)).toBeVisible();
    await expect(page.getByText(titleB)).toHaveCount(0);

    // Filtering to a single animal can only ever narrow (never widen) an
    // aggregate that spans all animals — B counted before and is excluded
    // now, so this holds regardless of any other pre-existing reminders.
    const statsAfter = Number.parseInt(
      (await page.getByTestId("stat-this-week-count").textContent()) ?? "0",
      10,
    );
    expect(statsAfter).toBeLessThan(statsBefore);

    // Cleanup — asserted.
    const delA = await db
      .from("health_reminders")
      .delete({ count: "exact" })
      .eq("profile_id", userId)
      .eq("title", titleA);
    expect(delA.count).toBe(1);
    const delB = await db
      .from("health_reminders")
      .delete({ count: "exact" })
      .eq("profile_id", userId)
      .eq("title", titleB);
    expect(delB.count).toBe(1);
    const hideA = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("id", animalA.data!.id);
    expect(hideA.count).toBe(1);
    const hideB = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("id", animalB.data!.id);
    expect(hideB.count).toBe(1);
  });
});
