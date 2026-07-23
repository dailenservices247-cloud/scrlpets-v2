"use client";

import { useEffect, useRef } from "react";

// F4 / punch list A3: feed videos autoplay (muted) while ~60% visible.
export function FeedVideo({
  src,
  className,
  loop = true,
}: {
  src: string;
  className?: string;
  loop?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      loop={loop}
      preload="metadata"
      className={className}
      data-testid="tile-media-video"
    />
  );
}
