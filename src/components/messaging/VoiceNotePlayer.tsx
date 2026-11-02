"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

export function VoiceNotePlayer({
  src,
  isMine = false,
}: {
  src: string;
  isMine?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`mt-2 flex w-64 max-w-full items-center gap-3 rounded-xl p-2.5 shadow-sm transition ${
        isMine ? "bg-primary-foreground/15 text-primary-foreground" : "border border-border/60 bg-muted/30 text-foreground"
      }`}
      data-testid="voice-note-player"
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        className={`grid size-9 shrink-0 place-items-center rounded-full transition hover:scale-105 active:scale-95 ${
          isMine ? "bg-white text-primary" : "bg-primary text-primary-foreground"
        }`}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        data-testid="voice-note-play-btn"
      >
        {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current translate-x-0.5" />}
      </button>

      <div className="flex flex-1 flex-col justify-center gap-1.5 min-w-0">
        <div className="relative flex items-center">
          {/* Waveform representation */}
          <div className="flex h-5 w-full items-center gap-0.5 overflow-hidden">
            {[40, 75, 55, 90, 60, 30, 80, 100, 70, 45, 85, 60, 95, 50, 65, 80, 40, 70, 90, 60, 35, 75].map((h, i) => {
              const barProgress = (i / 22) * 100;
              const isFilled = barProgress <= progressPercent;
              return (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-1 rounded-full transition-colors duration-150 ${
                    isFilled
                      ? isMine
                        ? "bg-white"
                        : "bg-brand-link"
                      : isMine
                        ? "bg-white/30"
                        : "bg-muted-foreground/30"
                  }`}
                />
              );
            })}
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Seek voice note"
          />
        </div>

        <div className="flex justify-between text-micro font-medium opacity-80">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : "0:30"}</span>
        </div>
      </div>
    </div>
  );
}
