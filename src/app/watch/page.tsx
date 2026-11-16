import Link from "next/link";
import { Video, Play, Film } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getReelQueue } from "@/lib/feed/query";

export const dynamic = "force-dynamic";

export default async function WatchPage() {
  const reels = await getReelQueue(24).catch(() => []);

  return (
    <AppPage>
      <div className="flex flex-col gap-6 px-3 py-4 sm:px-6 max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-brand-link">
              <Film className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Watch Reels
              </h1>
              <p className="text-xs text-muted-foreground">
                Short-form animal video clips and lineage updates from the community
              </p>
            </div>
          </div>

          <Link
            href="/compose?mode=post"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition"
            data-testid="watch-create-reel-btn"
          >
            <Video className="size-4" />
            <span>Create Reel</span>
          </Link>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Community Reels</h2>
            <span className="text-micro text-muted-foreground">
              {reels.length} {reels.length === 1 ? "reel" : "reels"}
            </span>
          </div>

          {reels.length === 0 ? (
            <div className="premium-panel rounded-2xl p-8 text-center">
              <Film className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
              <h3 className="mt-3 text-base font-semibold text-foreground">No reels shared yet</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Share a vertical video clip or social video link from the composer to appear here.
              </p>
              <Link
                href="/compose?mode=post"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                <Video className="size-4" />
                <span>Share Video Clip</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {reels.map((reel) => (
                <Link
                  key={reel.id}
                  href={`/watch/reel/${reel.id}`}
                  className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-xs transition hover:border-primary/50 hover:shadow-md cursor-pointer"
                  data-testid={`reel-card-${reel.id}`}
                >
                  {reel.mediaUrl ? (
                    <video
                      src={reel.mediaUrl}
                      className="size-full object-cover group-hover:scale-105 transition duration-300"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-b from-card to-muted/80 p-4 text-center">
                      <Film className="size-8 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <span className="grid size-12 place-items-center rounded-full bg-white/25 backdrop-blur-md text-white shadow-lg">
                      <Play className="size-6 fill-white ml-0.5" />
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
                    <p className="font-semibold text-xs text-white line-clamp-2 drop-shadow-sm">
                      {reel.title || "Untitled Reel"}
                    </p>
                    <div className="flex items-center justify-between gap-1 text-micro text-white/80">
                      <span className="truncate">@{reel.author.username}</span>
                      {reel.creature && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-micro font-medium text-white backdrop-blur-sm">
                          {reel.creature.name}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppPage>
  );
}
