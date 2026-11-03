"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const ACTIVE_PERSONA_COOKIE = "scrlpets_active_brand_id";

/**
 * Sets the active publishing/browsing persona: either personal (null)
 * or a specific brand ID that the user manages (like Facebook Business Page switching).
 */
export async function setActivePersona(brandId: string | null): Promise<{ ok: true }> {
  const store = await cookies();
  if (!brandId || brandId === "person") {
    store.delete(ACTIVE_PERSONA_COOKIE);
  } else {
    store.set(ACTIVE_PERSONA_COOKIE, brandId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }
  revalidatePath("/menu");
  revalidatePath("/compose");
  return { ok: true };
}

/**
 * Returns the currently active brand persona ID, or null if operating as personal profile.
 */
export async function getActivePersonaBrandId(): Promise<string | null> {
  const store = await cookies();
  const val = store.get(ACTIVE_PERSONA_COOKIE)?.value?.trim();
  return val && val !== "person" ? val : null;
}
