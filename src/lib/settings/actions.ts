"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

import { PREFERENCES_COOKIE, NOTIFICATIONS_COOKIE } from "./constants";

export async function savePreferences(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const store = await cookies();
  let existing: Record<string, unknown> = {};
  const existingRaw = store.get(PREFERENCES_COOKIE)?.value;
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  const units = formData.get("units") === "metric" ? "metric" : "imperial";
  const timeFormat = formData.get("timeFormat") === "24h" ? "24h" : "12h";
  const autoplayMedia = String(formData.get("autoplayMedia") ?? "always");

  const readBoolField = (key: string): boolean => {
    const raw = formData.get(key);
    if (raw === null) return Boolean(existing[key]);
    return raw === "true" || raw === "on" || raw === "1";
  };

  const prefs = {
    units,
    timeFormat,
    autoplayMedia,
    reduceMotion: readBoolField("reduceMotion"),
    highContrast: readBoolField("highContrast"),
    largeText: readBoolField("largeText"),
  };

  store.set(PREFERENCES_COOKIE, JSON.stringify(prefs), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  // If user selected species interests, update profile
  if (user) {
    const rawSpecies = formData.getAll("speciesInterests").map(String);
    if (rawSpecies.length > 0) {
      await supabase
        .from("profiles")
        .update({ species_interests: rawSpecies })
        .eq("id", user.id);
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/preferences");
  return { ok: true };
}

export async function saveNotificationSettings(formData: FormData): Promise<{ ok: boolean }> {
  const messages = formData.get("messages") === "on";
  const milestones = formData.get("milestones") === "on";
  const packActivity = formData.get("packActivity") === "on";
  const sounds = formData.get("sounds") === "on";

  const notifs = {
    messages,
    orders: true, // Always on for escrow and transactional safety
    milestones,
    packActivity,
    sounds,
  };

  const store = await cookies();
  store.set(NOTIFICATIONS_COOKIE, JSON.stringify(notifs), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath("/settings");
  revalidatePath("/settings/notifications");
  return { ok: true };
}
