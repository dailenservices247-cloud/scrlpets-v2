import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREFERENCES_COOKIE, NOTIFICATIONS_COOKIE } from "@/lib/settings/constants";

describe("settings architecture & localization", () => {
  const enMessages = JSON.parse(readFileSync("messages/en.json", "utf8"));
  const esMessages = JSON.parse(readFileSync("messages/es.json", "utf8"));
  const settingsPage = readFileSync("src/app/settings/page.tsx", "utf8");

  it("exports valid cookie constants for user preferences and notifications", () => {
    expect(PREFERENCES_COOKIE).toBe("scrlpets_user_prefs");
    expect(NOTIFICATIONS_COOKIE).toBe("scrlpets_notif_prefs");
  });

  it("has matching translation keys between en and es for the settings namespace", () => {
    expect(enMessages.settings).toBeDefined();
    expect(esMessages.settings).toBeDefined();

    const enKeys = Object.keys(enMessages.settings.rows).sort();
    const esKeys = Object.keys(esMessages.settings.rows).sort();
    expect(enKeys).toEqual(esKeys);

    const enGroups = Object.keys(enMessages.settings.groups).sort();
    const esGroups = Object.keys(esMessages.settings.groups).sort();
    expect(enGroups).toEqual(esGroups);
  });

  it("preserves all required e2e testids for settings rows", () => {
    const requiredTestIds = [
      "settings-row-profile",
      "settings-row-account",
      "settings-row-verification",
      "settings-row-subscription",
      "settings-row-payouts",
      "settings-row-referrals",
      "settings-row-preferences",
      "settings-row-notifications",
      "settings-row-privacy",
      "settings-row-animal-legality",
    ];

    for (const testId of requiredTestIds) {
      expect(settingsPage).toContain(testId);
    }
  });

  it("verifies root layout provides NextIntlClientProvider with dynamic locale and messages", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("getLocale");
    expect(layout).toContain("getMessages");
    expect(layout).toContain("<NextIntlClientProvider");
    expect(layout).toContain("locale={locale}");
    expect(layout).toContain("messages={messages}");
  });
});
