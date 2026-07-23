import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB photo cap for slice 2
const TYPES = ["image/jpeg", "image/png", "image/webp"];
// F4: video upload — Supabase free-tier file cap is 50MB.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type MediaKind = "image" | "video";

/** Pure validation, unit-testable. */
export function validateMediaFile(
  type: string,
  size: number,
): { kind: MediaKind } | { error: "type" | "size" } {
  if (TYPES.includes(type)) {
    return size > MAX_BYTES ? { error: "size" } : { kind: "image" };
  }
  if (VIDEO_TYPES.includes(type)) {
    return size > MAX_VIDEO_BYTES ? { error: "size" } : { kind: "video" };
  }
  return { error: "type" };
}

export async function uploadPhoto(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
  const result = await uploadMedia(file, userId);
  if ("error" in result) return result;
  if (result.kind !== "image") return { error: "type" };
  return { url: result.url };
}

/** F4: images and videos share the owner-pathed media bucket. */
export async function uploadMedia(
  file: File,
  userId: string,
): Promise<{ url: string; kind: MediaKind } | { error: string }> {
  const check = validateMediaFile(file.type, file.size);
  if ("error" in check) return check;
  const supabase = createClient();
  const ext = file.type === "video/quicktime" ? "mov" : file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl, kind: check.kind };
}
