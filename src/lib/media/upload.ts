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

/**
 * Strips metadata by re-encoding through a canvas: the decoded pixels are all
 * that survives, so EXIF — including the GPS tags a phone writes by default —
 * cannot reach the bucket. Dimensions and format are preserved.
 *
 * This matters more here than in most apps. Buyers and sellers arrange to meet
 * in person to hand over an animal, and photos are taken at home; publishing a
 * seller's coordinates with their listing is a physical-safety problem, not
 * just a privacy one.
 *
 * Fails CLOSED. If the image cannot be decoded or re-encoded, the upload is
 * refused rather than falling back to the original bytes — a silent fallback
 * would put the metadata back exactly when something unusual is going on.
 */
async function stripImageMetadata(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) =>
      // PNG ignores the quality argument and stays lossless, which also keeps
      // alpha intact; JPEG/WEBP re-encode at a visually neutral 0.92.
      canvas.toBlob((blob) => resolve(blob), file.type, 0.92),
    );
  } catch {
    return null;
  }
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

  // ponytail: images only. Stripping metadata from a video means demuxing and
  // remuxing it, which is not something to do on the main thread — video
  // location tags remain a known gap, tracked rather than silently implied
  // away. Photos are the overwhelming majority of uploads here.
  let body: Blob = file;
  if (check.kind === "image") {
    const cleaned = await stripImageMetadata(file);
    if (!cleaned) return { error: "process" };
    body = cleaned;
  }

  const { error } = await supabase.storage
    .from("media")
    .upload(path, body, { contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl, kind: check.kind };
}
