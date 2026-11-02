import { describe, it, expect } from "vitest";
import { isAudioUrl, isVideoUrl } from "@/lib/media/media-kind";

describe("Audio Media Kind", () => {
  it("identifies audio extensions correctly", () => {
    expect(isAudioUrl("https://example.com/recording.mp3")).toBe(true);
    expect(isAudioUrl("https://example.com/audio.wav")).toBe(true);
    expect(isAudioUrl("https://example.com/sound.m4a")).toBe(true);
    expect(isAudioUrl("https://example.com/track.ogg")).toBe(true);
    expect(isAudioUrl("https://example.com/clip.aac")).toBe(true);
  });

  it("identifies audio-specific path conventions", () => {
    expect(isAudioUrl("https://supabase.co/storage/v1/object/public/media/user123/audio-abc.webm")).toBe(true);
    expect(isAudioUrl("data:audio/webm;base64,GkXfo59ChoEBQveBAULnxTU6KCAC")).toBe(true);
    expect(isAudioUrl("https://example.com/media/audio-note-555")).toBe(true);
  });

  it("does not false-positive on regular videos or images", () => {
    expect(isAudioUrl("https://example.com/video.mp4")).toBe(false);
    expect(isAudioUrl("https://example.com/photo.jpg")).toBe(false);
    expect(isAudioUrl("https://example.com/image.webp")).toBe(false);
    expect(isAudioUrl(null)).toBe(false);
  });

  it("maintains separation between video and audio helpers", () => {
    expect(isVideoUrl("https://example.com/puppy.mp4")).toBe(true);
    expect(isVideoUrl("https://example.com/recording.mp3")).toBe(false);
  });
});
