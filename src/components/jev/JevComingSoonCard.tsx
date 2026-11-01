"use client";

import { useState } from "react";
import {
  Sparkles,
  Dna,
  Bot,
  CalendarCheck,
  Truck,
  Bell,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const JEV_CAPABILITIES = [
  {
    icon: Dna,
    title: "Lineage & Kinship Intelligence",
    description:
      "Automated coefficient of inbreeding (COI), 3-generation health panel compatibility, and pedigree risk screening before breeding.",
    badge: "Genetics",
  },
  {
    icon: Bot,
    title: "24/7 Kennel Concierge & Screening",
    description:
      "Answers buyer inquiries about your dogs, pre-screens adoption applications, and drafts Deal Room agreements around the clock.",
    badge: "Operations",
  },
  {
    icon: CalendarCheck,
    title: "Whelping & Care Progress Tracker",
    description:
      "Automated gestation milestones, daily whelping temp-drop monitoring, and puppy weight gain charting with vet reminders.",
    badge: "Health",
  },
  {
    icon: Truck,
    title: "Safe Courier & CVI Coordinator",
    description:
      "Cross-references interstate veterinary health certificate laws and quotes licensed USDA-certified pet couriers with zero platform liability.",
    badge: "Logistics",
  },
];

export function JevComingSoonCard({
  source = "general",
}: {
  source?: "hub" | "brand-os" | "general";
}) {
  const [joined, setJoined] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return window.localStorage.getItem("scrlpets_jev_waitlist") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });
  const [openModal, setOpenModal] = useState(false);

  function handleJoin() {
    setJoined(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("scrlpets_jev_waitlist", "true");
      }
    } catch {
      // Ignore storage errors
    }
  }

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-sm transition hover:border-primary/50 sm:p-6"
      data-testid={`jev-coming-soon-card-${source}`}
    >
      {/* Decorative ambient glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-micro font-semibold text-brand-link">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span>Coming Soon · Intelligent Kennel OS</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Meet Jev AI — Animal Intelligence & Kennel Operations
          </h2>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Your dedicated 24/7 co-pilot for breeding genetics, client inquiry screening, whelping tracking, and verified pet transport logistics. Designed exclusively for authentic breeders and serious pet owners.
          </p>
        </div>

        <div className="shrink-0 pt-1">
          {joined ? (
            <div
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              data-testid="jev-waitlist-confirmed"
            >
              <CheckCircle2 className="size-4" aria-hidden />
              <span>Priority Access Confirmed</span>
            </div>
          ) : (
            <Button
              onClick={handleJoin}
              className="min-h-11 font-semibold shadow-sm"
              data-testid="jev-waitlist-button"
            >
              <Bell className="mr-2 size-4" aria-hidden />
              Notify Me When Jev Launches
            </Button>
          )}
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {JEV_CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.title}
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm transition hover:border-primary/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="rounded-md border border-input px-2 py-0.5 text-micro font-medium text-muted-foreground">
                    {cap.badge}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{cap.title}</h3>
                <p className="mt-1.5 text-micro leading-5 text-muted-foreground">
                  {cap.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Note */}
      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4 text-micro text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>Architecture & model training in active development. Free early preview upon release.</span>
        </p>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="inline-flex items-center gap-1 font-medium text-brand-link hover:underline"
        >
          <span>View complete AI roadmap</span>
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* AI Roadmap Dialog */}
      {openModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h3 className="text-lg font-bold">Jev AI Roadmap</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="font-semibold text-foreground">Phase 1 · Pedigree & Health Verification</p>
                <p className="mt-0.5">Automated OFA/DNA certificate verification, COI calculation, and lineage tree health warnings.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="font-semibold text-foreground">Phase 2 · Autonomous Yard Concierge</p>
                <p className="mt-0.5">Automated screening of prospective pet buyers, application evaluation, and Deal Room calendar scheduling.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="font-semibold text-foreground">Phase 3 · Interstate Transport Escort</p>
                <p className="mt-0.5">Direct integration with licensed USDA pet couriers and automatic interstate Certificate of Veterinary Inspection compliance.</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setOpenModal(false)} className="font-semibold">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
