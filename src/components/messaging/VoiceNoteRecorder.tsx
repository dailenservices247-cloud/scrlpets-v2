"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send, Play, Pause, Loader2 } from "lucide-react";
import { uploadVoiceNote } from "@/lib/media/upload";

const MAX_RECORDING_SECONDS = 30;

export function VoiceNoteRecorder({
  userId,
  onVoiceNoteUploaded,
  disabled = false,
}: {
  userId: string;
  onVoiceNoteUploaded: (url: string) => void;
  disabled?: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [previewUrl]);

  const startRecording = async () => {
    setErrorMessage(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setErrorMessage("Microphone permission denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const discardRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setIsRecording(false);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setSeconds(0);
    setIsPreviewPlaying(false);
    setErrorMessage(null);
  };

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPreviewPlaying(true);
    }
  };

  const handleSend = async () => {
    if (!recordedBlob) return;
    setIsUploading(true);
    setErrorMessage(null);

    const result = await uploadVoiceNote(recordedBlob, userId);
    setIsUploading(false);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    onVoiceNoteUploaded(result.url);
    discardRecording();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (isRecording) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        data-testid="voice-recorder-active"
      >
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-destructive opacity-90" />
          <span className="font-mono text-xs font-semibold text-destructive">
            {formatTimer(seconds)} / {formatTimer(MAX_RECORDING_SECONDS)}
          </span>
          <span className="text-xs text-muted-foreground">Recording voice note...</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={discardRecording}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            aria-label="Discard recording"
            data-testid="voice-discard-btn"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="grid size-8 place-items-center rounded-lg bg-destructive text-destructive-foreground hover:opacity-90"
            aria-label="Stop recording"
            data-testid="voice-stop-btn"
          >
            <Square className="size-4 fill-current" />
          </button>
        </div>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-card p-2 text-sm shadow-sm"
        data-testid="voice-recorder-preview"
      >
        {/* Hidden preview audio element */}
        <audio
          ref={previewAudioRef}
          src={previewUrl}
          onEnded={() => setIsPreviewPlaying(false)}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePreviewPlay}
            className="grid size-8 place-items-center rounded-full bg-primary/20 text-brand-link hover:bg-primary/30"
            aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}
            data-testid="voice-preview-toggle"
          >
            {isPreviewPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-0.5" />}
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            Voice Note ({formatTimer(seconds || 1)})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={discardRecording}
            disabled={isUploading}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Discard audio"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            data-testid="voice-send-btn"
          >
            {isUploading ? <Loader2 className="size-3.5 opacity-70" /> : <Send className="size-3.5" />}
            <span>Send</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center">
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className="grid size-9 place-items-center rounded-xl border border-input text-muted-foreground transition hover:border-primary/40 hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
        aria-label="Record voice note"
        title="Record voice note"
        data-testid="voice-record-btn"
      >
        <Mic className="size-4" />
      </button>
      {errorMessage && (
        <span className="ml-2 text-xs text-destructive">{errorMessage}</span>
      )}
    </div>
  );
}
