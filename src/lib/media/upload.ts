import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB photo cap for slice 2
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadPhoto(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
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
