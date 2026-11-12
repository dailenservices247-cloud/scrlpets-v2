"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Cpu,
  Flame,
  Gamepad2,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  MessageSquare,
  QrCode,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Store,
  Smartphone,
  Utensils,
  Video,
  Wallet,
} from "lucide-react";
import {
  FOOD_VERTICAL_DOSSIERS,
  FOOD_VERTICAL_NAME_CANDIDATES,
  SYNERGY_MESSENGER_THREADS,
  SYNERGY_STORE_MODULES,
  TECH_VERTICAL_DOSSIERS,
  TECH_VERTICAL_NAME_CANDIDATES,
  type FoodVerticalPillarId,
  type GenUiModeId,
  type MessengerVerticalFilter,
  type SynergyMessengerThread,
  type SynergyPersonaId,
  type TechVerticalPillarId,
} from "@/lib/synergy/catalog";

type EcosystemSurfaceId =
  | "synergy_shell"
  | "tech_vertical"
  | "food_vertical"
  | "synergy_messenger";

const PERSONA_OPTIONS: {
  id: SynergyPersonaId;
  label: string;
  handle: string;
  badge: string;
}[] = [
  {
    id: "personal",
    label: "Personal Identity",
    handle: "@dailen",
    badge: "Consumer & Collector",
  },
  {
    id: "creator",
    label: "Verified Creator",
    handle: "@allday24seven",
    badge: "Reels · Live · Tipping",
  },
  {
    id: "brand_os",
    label: "Brand OS Operator",
    handle: "Black Sheep 247 · Danu's Ark",
    badge: "Escrow · Dossiers · Storefront",
  },
];

const GENUI_MODES: {
  id: GenUiModeId;
  label: string;
  description: string;
}[] = [
  {
    id: "thumb",
    label: "Thumb Mode",
    description: "Bottom-anchored 1-hand mobile reachability",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "9:16 high-contrast media & live streams",
  },
  {
    id: "studio",
    label: "Studio OS",
    description: "3-pane operator telemetry & multi-vertical control",
  },
  {
    id: "calm",
    label: "Calm Focus",
    description: "Low-stimulus ambient layout · zero badge noise",
  },
];

export function SynergyEcosystemClient() {
  const [veilDismissed, setVeilDismissed] = useState(false);
  const [activeSurface, setActiveSurface] =
    useState<EcosystemSurfaceId>("synergy_shell");
  const [activePersona, setActivePersona] =
    useState<SynergyPersonaId>("brand_os");
  const [genUiMode, setGenUiMode] = useState<GenUiModeId>("studio");
  const [stimulationLevel, setStimulationLevel] = useState<number>(3);
  const [serendipityPct, setSerendipityPct] = useState<number>(28);
  const [shellCenterView, setShellCenterView] = useState<"grid" | "cosmos">(
    "grid",
  );

  // Installed modules in Ecosystem Store
  const [installedModules, setInstalledModules] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      SYNERGY_STORE_MODULES.map((m) => [m.id, m.installedByDefault]),
    ),
  );

  // Vertical #2 (Tech, Gaming & AI) state
  const [selectedTechNameId, setSelectedTechNameId] = useState<string>("anvil");
  const [activeTechPillar, setActiveTechPillar] =
    useState<TechVerticalPillarId>("hardware");

  // Vertical #3 (Food Reviews & Recipes) state
  const [selectedFoodNameId, setSelectedFoodNameId] = useState<string>("savor");
  const [activeFoodPillar, setActiveFoodPillar] =
    useState<FoodVerticalPillarId>("local_eats");
  const [recipeServingsScale, setRecipeServingsScale] = useState<number>(4);

  // Synergy Messenger state
  const [messengerFilter, setMessengerFilter] =
    useState<MessengerVerticalFilter>("all");
  const [threads, setThreads] = useState<SynergyMessengerThread[]>(
    SYNERGY_MESSENGER_THREADS,
  );
  const [activeThreadId, setActiveThreadId] = useState<string>(
    SYNERGY_MESSENGER_THREADS[0].id,
  );
  const [draftMessage, setDraftMessage] = useState<string>("");
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);

  const selectedTechName = useMemo(
    () =>
      TECH_VERTICAL_NAME_CANDIDATES.find((c) => c.id === selectedTechNameId) ??
      TECH_VERTICAL_NAME_CANDIDATES[0],
    [selectedTechNameId],
  );

  const selectedFoodName = useMemo(
    () =>
      FOOD_VERTICAL_NAME_CANDIDATES.find((c) => c.id === selectedFoodNameId) ??
      FOOD_VERTICAL_NAME_CANDIDATES[0],
    [selectedFoodNameId],
  );

  const activeTechDossier = useMemo(
    () =>
      TECH_VERTICAL_DOSSIERS.find((d) => d.pillar === activeTechPillar) ??
      TECH_VERTICAL_DOSSIERS[0],
    [activeTechPillar],
  );

  const activeFoodDossier = useMemo(
    () =>
      FOOD_VERTICAL_DOSSIERS.find((d) => d.pillar === activeFoodPillar) ??
      FOOD_VERTICAL_DOSSIERS[0],
    [activeFoodPillar],
  );

  const filteredThreads = useMemo(() => {
    if (messengerFilter === "all") return threads;
    return threads.filter((t) => t.vertical === messengerFilter);
  }, [threads, messengerFilter]);

  const activeThread = useMemo(
    () =>
      threads.find((t) => t.id === activeThreadId) ??
      filteredThreads[0] ??
      threads[0],
    [threads, activeThreadId, filteredThreads],
  );

  const currentPersonaObj = useMemo(
    () =>
      PERSONA_OPTIONS.find((p) => p.id === activePersona) ?? PERSONA_OPTIONS[0],
    [activePersona],
  );

  function handleOpenMessengerWithThread(threadId: string) {
    setActiveThreadId(threadId);
    setMessengerFilter("all");
    setActiveSurface("synergy_messenger");
  }

  function handleToggleModule(moduleId: string, locked?: boolean) {
    if (locked) return;
    setInstalledModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draftMessage.trim();
    if (!trimmed || !activeThread) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              lastMessage: trimmed,
              timestamp: "Just now",
              messages: [
                ...t.messages,
                {
                  id: `msg-${Date.now()}`,
                  sender: "me",
                  text: trimmed,
                  time: "Just now",
                },
              ],
            }
          : t,
      ),
    );
    setDraftMessage("");
  }

  function handleReleaseHandover(threadId: string) {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              dealCard: {
                ...t.dealCard,
                status: "released",
              },
              lastMessage:
                "✅ In-person QR Handover verified! Held Payment funds released immediately.",
              timestamp: "Just now",
              messages: [
                ...t.messages,
                {
                  id: `release-${Date.now()}`,
                  sender: "me",
                  text: "✅ Scanned QR Handover Code & verified 6-digit PIN in Synergy Messenger. Held funds released!",
                  time: "Just now",
                },
              ],
            }
          : t,
      ),
    );
    setQrModalOpen(false);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "var(--bg-void)",
        color: "var(--fg-bone)",
      }}
    >
      {/* Top Ecosystem Monopoly Bar */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--border-hairline)",
          backgroundColor:
            "color-mix(in srgb, var(--bg-void) 90%, transparent)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Brand Identity + Keychain SSO Pill */}
          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition hover:opacity-90"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-surface)",
                fontSize: "var(--text-meta)",
                color: "var(--fg-smoke)",
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Scrlpets Feed
            </Link>

            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold"
                style={{
                  backgroundColor: "var(--accent-purple)",
                  color: "var(--fg-bone)",
                  fontSize: "var(--text-ui)",
                }}
              >
                S
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-bold tracking-tight"
                    style={{ fontSize: "var(--text-ui)" }}
                  >
                    SYNERGY OS
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--accent-gold)",
                      fontSize: "var(--text-micro)",
                    }}
                  >
                    Black Sheep 247 Keychain SSO
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--fg-ash)",
                  }}
                >
                  group.com.blacksheep247.synergy · iOS & Android Family
                </p>
              </div>
            </div>
          </div>

          {/* Center: 4-Surface Ecosystem Switcher */}
          <nav
            aria-label="Synergy Ecosystem Switcher"
            className="flex flex-wrap items-center gap-1.5 rounded-xl border p-1"
            style={{
              borderColor: "var(--border-hairline)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSurface("synergy_shell")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition"
              style={{
                fontSize: "var(--text-meta)",
                backgroundColor:
                  activeSurface === "synergy_shell"
                    ? "var(--accent-purple)"
                    : "transparent",
                color:
                  activeSurface === "synergy_shell"
                    ? "var(--fg-bone)"
                    : "var(--fg-smoke)",
              }}
            >
              <Globe className="h-3.5 w-3.5" />
              Synergy OS Shell
            </button>

            <button
              type="button"
              onClick={() => setActiveSurface("tech_vertical")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition"
              style={{
                fontSize: "var(--text-meta)",
                backgroundColor:
                  activeSurface === "tech_vertical"
                    ? "var(--accent-purple)"
                    : "transparent",
                color:
                  activeSurface === "tech_vertical"
                    ? "var(--fg-bone)"
                    : "var(--fg-smoke)",
              }}
            >
              <Cpu className="h-3.5 w-3.5" />
              Vertical #2: {selectedTechName.name}
            </button>

            <button
              type="button"
              onClick={() => setActiveSurface("food_vertical")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition"
              style={{
                fontSize: "var(--text-meta)",
                backgroundColor:
                  activeSurface === "food_vertical"
                    ? "var(--accent-purple)"
                    : "transparent",
                color:
                  activeSurface === "food_vertical"
                    ? "var(--fg-bone)"
                    : "var(--fg-smoke)",
              }}
            >
              <Utensils className="h-3.5 w-3.5" />
              Vertical #3: {selectedFoodName.name}
            </button>

            <button
              type="button"
              onClick={() => setActiveSurface("synergy_messenger")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition"
              style={{
                fontSize: "var(--text-meta)",
                backgroundColor:
                  activeSurface === "synergy_messenger"
                    ? "var(--accent-purple)"
                    : "transparent",
                color:
                  activeSurface === "synergy_messenger"
                    ? "var(--fg-bone)"
                    : "var(--fg-smoke)",
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Synergy Messenger
              <span
                className="rounded-full px-1.5 py-0.2 font-bold"
                style={{
                  backgroundColor: "var(--accent-gold)",
                  color: "var(--bg-void)",
                  fontSize: "var(--text-micro)",
                }}
              >
                {threads.filter((t) => t.unread).length}
              </span>
            </button>
          </nav>

          {/* Right: OS Persona Switcher */}
          <div className="flex items-center gap-2">
            <KeyRound
              className="h-3.5 w-3.5"
              style={{ color: "var(--accent-gold)" }}
            />
            <select
              aria-label="Active Synergy Persona"
              value={activePersona}
              onChange={(e) =>
                setActivePersona(e.target.value as SynergyPersonaId)
              }
              className="rounded-lg border px-2.5 py-1.5 font-medium outline-none"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--fg-bone)",
                fontSize: "var(--text-meta)",
              }}
            >
              {PERSONA_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.handle})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Optional Veil Entrance Banner */}
      {!veilDismissed && (
        <section
          className="border-b px-4 py-4"
          style={{
            borderColor: "var(--border-hairline)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 font-semibold"
                  style={{
                    backgroundColor: "var(--accent-purple)",
                    color: "var(--fg-bone)",
                    fontSize: "var(--text-micro)",
                  }}
                >
                  THE VEIL · CONTINUOUS ENTRANCE
                </span>
                <span
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Signed in once as{" "}
                  <strong style={{ color: "var(--fg-bone)" }}>
                    {currentPersonaObj.handle}
                  </strong>{" "}
                  across all Black Sheep 247 apps
                </span>
              </div>
              <p
                style={{
                  fontSize: "var(--text-body)",
                  color: "var(--fg-bone)",
                }}
              >
                One unified identity, wallet, and auto-connected Messenger across{" "}
                <strong>Scrlpets (Vertical #1)</strong>,{" "}
                <strong>{selectedTechName.name} (Vertical #2: Tech, Gaming & AI)</strong>, and{" "}
                <strong>{selectedFoodName.name} (Vertical #3: Food Reviews & Recipes)</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setVeilDismissed(true)}
                className="rounded-lg border px-3 py-1.5 font-medium transition hover:opacity-90"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--fg-bone)",
                  fontSize: "var(--text-meta)",
                }}
              >
                Enter Spatial Workspace
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Workspace Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* =========================================================
            SURFACE 1: SYNERGY OS 3-ZONE SPATIAL SHELL
           ========================================================= */}
        {activeSurface === "synergy_shell" && (
          <div className="space-y-6">
            {/* GenUI Mode Bar + Stimulation & Serendipity Dials */}
            <div
              className="rounded-2xl border p-4 grid grid-cols-1 lg:grid-cols-3 gap-4"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sliders
                    className="h-4 w-4"
                    style={{ color: "var(--accent-purple)" }}
                  />
                  <span
                    className="font-semibold"
                    style={{ fontSize: "var(--text-ui)" }}
                  >
                    GenUI Layout Mode
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {GENUI_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setGenUiMode(m.id)}
                      className="rounded-lg border px-2.5 py-1.5 text-left transition"
                      style={{
                        borderColor:
                          genUiMode === m.id
                            ? "var(--accent-purple)"
                            : "var(--border-hairline)",
                        backgroundColor:
                          genUiMode === m.id
                            ? "var(--bg-elevated)"
                            : "transparent",
                      }}
                    >
                      <div
                        className="font-semibold"
                        style={{ fontSize: "var(--text-meta)" }}
                      >
                        {m.label}
                      </div>
                      <div
                        className="truncate"
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-ash)",
                        }}
                      >
                        {m.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-semibold"
                    style={{ fontSize: "var(--text-ui)" }}
                  >
                    Stimulation Budget Dial
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 font-mono"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--accent-gold)",
                      fontSize: "var(--text-meta)",
                    }}
                  >
                    Level {stimulationLevel} / 5
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={stimulationLevel}
                  onChange={(e) => setStimulationLevel(Number(e.target.value))}
                  className="w-full accent-purple-500"
                  aria-label="Stimulation Budget Dial"
                />
                <p
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  {stimulationLevel <= 2
                    ? "Low-Stimulus Calm: Mutes autoplay reels and condenses badges."
                    : stimulationLevel === 3
                      ? "Balanced Operator Mode: Live deal cards + ambient telemetry."
                      : "High-Velocity Studio: Full multi-vertical streams & live ticker."}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="font-semibold"
                    style={{ fontSize: "var(--text-ui)" }}
                  >
                    Ethical Serendipity Dial
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 font-mono"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--status-success)",
                      fontSize: "var(--text-meta)",
                    }}
                  >
                    {serendipityPct}% Discovery
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={serendipityPct}
                  onChange={(e) => setSerendipityPct(Number(e.target.value))}
                  className="w-full accent-purple-500"
                  aria-label="Ethical Serendipity Dial"
                />
                <p
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  You control the algorithm: {100 - serendipityPct}% locked
                  Kin/Mentors/Peers graph · {serendipityPct}% cross-vertical
                  discovery.
                </p>
              </div>
            </div>

            {/* 3-Zone Spatial Shell Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT PANE: Ecosystem Store (Install / Uninstall Verticals & Modules) */}
              <aside
                className="lg:col-span-3 rounded-2xl border p-4 space-y-4"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store
                      className="h-4 w-4"
                      style={{ color: "var(--accent-purple)" }}
                    />
                    <h2
                      className="font-bold"
                      style={{ fontSize: "var(--text-ui)" }}
                    >
                      Left Pane · Ecosystem Store
                    </h2>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--fg-smoke)",
                      fontSize: "var(--text-micro)",
                    }}
                  >
                    {Object.values(installedModules).filter(Boolean).length}{" "}
                    Active
                  </span>
                </div>

                <p
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Synergy never forces bloatware. Toggle verticals and sovereign
                  modules into your dock at zero extra infrastructure cost.
                </p>

                <div className="space-y-2.5">
                  {SYNERGY_STORE_MODULES.map((mod) => {
                    const isInstalled = !!installedModules[mod.id];
                    return (
                      <div
                        key={mod.id}
                        className="rounded-xl border p-3 space-y-2"
                        style={{
                          borderColor: isInstalled
                            ? "var(--accent-purple)"
                            : "var(--border-hairline)",
                          backgroundColor: "var(--bg-elevated)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div
                              className="font-semibold"
                              style={{ fontSize: "var(--text-meta)" }}
                            >
                              {mod.id === "tech_vertical"
                                ? `${selectedTechName.name} (Tech, Gaming & AI)`
                                : mod.id === "food_vertical"
                                  ? `${selectedFoodName.name} (Food & Recipes)`
                                  : mod.name}
                            </div>
                            <span
                              className="inline-block rounded px-1.5 py-0.5"
                              style={{
                                backgroundColor: "var(--bg-surface)",
                                color: "var(--accent-gold)",
                                fontSize: "var(--text-micro)",
                              }}
                            >
                              {mod.badge}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={mod.lockedCore}
                            onClick={() =>
                              handleToggleModule(mod.id, mod.lockedCore)
                            }
                            className="rounded-md px-2 py-1 font-medium transition"
                            style={{
                              fontSize: "var(--text-micro)",
                              backgroundColor: isInstalled
                                ? "var(--accent-purple)"
                                : "var(--bg-surface)",
                              color: "var(--fg-bone)",
                              opacity: mod.lockedCore ? 0.75 : 1,
                            }}
                          >
                            {mod.lockedCore
                              ? "Core OS"
                              : isInstalled
                                ? "Docked ✓"
                                : "+ Dock"}
                          </button>
                        </div>
                        <p
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          {mod.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* CENTER PANE: Home Grid <-> Cosmos Constellation ZUI */}
              <section
                className="lg:col-span-6 rounded-2xl border p-5 space-y-5"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h1
                      className="font-bold"
                      style={{ fontSize: "var(--text-title)" }}
                    >
                      Center Pane · Monopoly Command Surface
                    </h1>
                    <p
                      style={{
                        fontSize: "var(--text-meta)",
                        color: "var(--fg-smoke)",
                      }}
                    >
                      Alphabet/Meta-grade multi-vertical hub powered by one
                      shared Supabase + Stripe Connect + C2PA engine.
                    </p>
                  </div>

                  <div
                    className="inline-flex rounded-lg border p-0.5"
                    style={{
                      borderColor: "var(--border-hairline)",
                      backgroundColor: "var(--bg-elevated)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShellCenterView("grid")}
                      className="rounded-md px-2.5 py-1 font-medium"
                      style={{
                        fontSize: "var(--text-micro)",
                        backgroundColor:
                          shellCenterView === "grid"
                            ? "var(--accent-purple)"
                            : "transparent",
                        color: "var(--fg-bone)",
                      }}
                    >
                      Vertical Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setShellCenterView("cosmos")}
                      className="rounded-md px-2.5 py-1 font-medium"
                      style={{
                        fontSize: "var(--text-micro)",
                        backgroundColor:
                          shellCenterView === "cosmos"
                            ? "var(--accent-purple)"
                            : "transparent",
                        color: "var(--fg-bone)",
                      }}
                    >
                      Cosmos ZUI Map
                    </button>
                  </div>
                </div>

                {shellCenterView === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Vertical #1: Scrlpets */}
                    <div
                      className="rounded-xl border p-4 flex flex-col justify-between space-y-3"
                      style={{
                        borderColor: "var(--border-hairline)",
                        backgroundColor: "var(--bg-elevated)",
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="rounded-md px-2 py-0.5 font-semibold"
                            style={{
                              backgroundColor: "var(--bg-surface)",
                              color: "var(--status-success)",
                              fontSize: "var(--text-micro)",
                            }}
                          >
                            VERTICAL #1 · ANIMALS & LINEAGE
                          </span>
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--fg-ash)",
                            }}
                          >
                            v0.4.1 Live
                          </span>
                        </div>
                        <h3
                          className="font-bold"
                          style={{ fontSize: "var(--text-ui)" }}
                        >
                          🐾 Scrlpets
                        </h3>
                        <p
                          style={{
                            fontSize: "var(--text-meta)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          5-Gen COI Pedigrees, Whelping Calculator, Statutory
                          State Disclosures, and Held Payment QR Puppy
                          Handovers.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Link
                          href="/c/big-meech"
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold"
                          style={{
                            backgroundColor: "var(--accent-purple)",
                            color: "var(--fg-bone)",
                            fontSize: "var(--text-micro)",
                          }}
                        >
                          Open Animal Dossier
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenMessengerWithThread(
                              "thread-scrlpets-meech",
                            )
                          }
                          className="rounded-lg border px-2.5 py-1.5 font-medium"
                          style={{
                            borderColor: "var(--border-hairline)",
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-bone)",
                          }}
                        >
                          Buyer Chat
                        </button>
                      </div>
                    </div>

                    {/* Vertical #2: Tech, Gaming & AI */}
                    <div
                      className="rounded-xl border p-4 flex flex-col justify-between space-y-3"
                      style={{
                        borderColor: "var(--accent-purple)",
                        backgroundColor: "var(--bg-elevated)",
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="rounded-md px-2 py-0.5 font-semibold"
                            style={{
                              backgroundColor: "var(--bg-surface)",
                              color: "var(--accent-gold)",
                              fontSize: "var(--text-micro)",
                            }}
                          >
                            VERTICAL #2 · TECH, GAMING & AI
                          </span>
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--fg-ash)",
                            }}
                          >
                            3 Pillars
                          </span>
                        </div>
                        <h3
                          className="font-bold"
                          style={{ fontSize: "var(--text-ui)" }}
                        >
                          ⚡ {selectedTechName.name}
                        </h3>
                        <p
                          style={{
                            fontSize: "var(--text-meta)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          Custom PC & Console Rigs, Competitive Gaming Mods &
                          9:16 Clips, plus Verified AI Agent Skill Packs.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveSurface("tech_vertical")}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold"
                          style={{
                            backgroundColor: "var(--accent-purple)",
                            color: "var(--fg-bone)",
                            fontSize: "var(--text-micro)",
                          }}
                        >
                          Explore {selectedTechName.name}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenMessengerWithThread(
                              "thread-tech-rig-5090",
                            )
                          }
                          className="rounded-lg border px-2.5 py-1.5 font-medium"
                          style={{
                            borderColor: "var(--border-hairline)",
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-bone)",
                          }}
                        >
                          Rig Escrow Chat
                        </button>
                      </div>
                    </div>

                    {/* Vertical #3: Food Reviews & Recipes */}
                    <div
                      className="rounded-xl border p-4 flex flex-col justify-between space-y-3"
                      style={{
                        borderColor: "var(--accent-gold)",
                        backgroundColor: "var(--bg-elevated)",
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="rounded-md px-2 py-0.5 font-semibold"
                            style={{
                              backgroundColor: "var(--bg-surface)",
                              color: "var(--accent-gold)",
                              fontSize: "var(--text-micro)",
                            }}
                          >
                            VERTICAL #3 · FOOD & RECIPES
                          </span>
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--fg-ash)",
                            }}
                          >
                            3x/Day Habit
                          </span>
                        </div>
                        <h3
                          className="font-bold"
                          style={{ fontSize: "var(--text-ui)" }}
                        >
                          🍽️ {selectedFoodName.name}
                        </h3>
                        <p
                          style={{
                            fontSize: "var(--text-meta)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          Receipt-Verified Food Reviews (0 fake bots), Forkable
                          3-Gen Recipe Pedigrees, and Protected QR Food-Truck
                          Pickup.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveSurface("food_vertical")}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold"
                          style={{
                            backgroundColor: "var(--accent-purple)",
                            color: "var(--fg-bone)",
                            fontSize: "var(--text-micro)",
                          }}
                        >
                          Explore {selectedFoodName.name}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenMessengerWithThread("thread-food-otates")
                          }
                          className="rounded-lg border px-2.5 py-1.5 font-medium"
                          style={{
                            borderColor: "var(--border-hairline)",
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-bone)",
                          }}
                        >
                          Pickup QR Chat
                        </button>
                      </div>
                    </div>

                    {/* Connected App: Synergy Messenger */}
                    <div
                      className="rounded-xl border p-4 flex flex-col justify-between space-y-3"
                      style={{
                        borderColor: "var(--border-hairline)",
                        backgroundColor: "var(--bg-elevated)",
                      }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="rounded-md px-2 py-0.5 font-semibold"
                            style={{
                              backgroundColor: "var(--bg-surface)",
                              color: "var(--fg-bone)",
                              fontSize: "var(--text-micro)",
                            }}
                          >
                            STANDALONE CONNECTED APP
                          </span>
                          <Smartphone className="h-3.5 w-3.5" />
                        </div>
                        <h3
                          className="font-bold"
                          style={{ fontSize: "var(--text-ui)" }}
                        >
                          💬 Synergy Messenger
                        </h3>
                        <p
                          style={{
                            fontSize: "var(--text-meta)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          Meta-style companion app. Tapping &ldquo;Message&rdquo;
                          in Scrlpets, {selectedTechName.name}, or{" "}
                          {selectedFoodName.name} deep-links here with the Deal
                          Dossier & QR Handover card pinned.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSurface("synergy_messenger")
                          }
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold"
                          style={{
                            backgroundColor: "var(--accent-purple)",
                            color: "var(--fg-bone)",
                            fontSize: "var(--text-micro)",
                          }}
                        >
                          Launch Messenger Inbox
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Cosmos Constellation ZUI View */
                  <div
                    className="rounded-xl border p-5 space-y-4"
                    style={{
                      borderColor: "var(--border-hairline)",
                      backgroundColor: "var(--bg-elevated)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-semibold"
                        style={{ fontSize: "var(--text-ui)" }}
                      >
                        🌌 Cosmos Spatial Graph · Shared Engine Reuse Map
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--accent-gold)",
                        }}
                      >
                        1 Codebase · 3 Verticals · $0 Marginal Infra Cost
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div
                        className="rounded-lg border p-3"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-surface)",
                        }}
                      >
                        <div
                          className="font-bold mb-1"
                          style={{ fontSize: "var(--text-meta)" }}
                        >
                          1. Lineage Canvas Engine
                        </div>
                        <p
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          • <strong>Scrlpets:</strong> 5-Gen Dog Pedigree & COI
                          <br />• <strong>{selectedTechName.name}:</strong> PC
                          Parts & Agent Dependency Tree
                          <br />• <strong>{selectedFoodName.name}:</strong>{" "}
                          3-Gen Family Recipe Remix Tree
                        </p>
                      </div>

                      <div
                        className="rounded-lg border p-3"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-surface)",
                        }}
                      >
                        <div
                          className="font-bold mb-1"
                          style={{ fontSize: "var(--text-meta)" }}
                        >
                          2. Verified Passport Engine
                        </div>
                        <p
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          • <strong>Scrlpets:</strong> OFA / DNA / Vet Clearances
                          <br />• <strong>{selectedTechName.name}:</strong>{" "}
                          3DMark / Thermal / Input-Latency Proof
                          <br />• <strong>{selectedFoodName.name}:</strong>{" "}
                          Receipt-Verified Diner Review & Macros
                        </p>
                      </div>

                      <div
                        className="rounded-lg border p-3"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-surface)",
                        }}
                      >
                        <div
                          className="font-bold mb-1"
                          style={{ fontSize: "var(--text-meta)" }}
                        >
                          3. Held Payment + QR Handover
                        </div>
                        <p
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          • <strong>Scrlpets:</strong> In-Person Puppy Handover
                          <br />• <strong>{selectedTechName.name}:</strong>{" "}
                          Custom Rig Local Boot Check
                          <br />• <strong>{selectedFoodName.name}:</strong>{" "}
                          Food-Truck Window QR Pickup
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ethical Social Graph Stratification Strip */}
                <div
                  className="rounded-xl border p-4 space-y-2"
                  style={{
                    borderColor: "var(--border-hairline)",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-semibold"
                      style={{ fontSize: "var(--text-meta)" }}
                    >
                      Ethical Social Graph (Replaces Vanity Follower Counts)
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-micro)",
                        color: "var(--fg-ash)",
                      }}
                    >
                      Zero Doomscroll Infinite Traps
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      className="rounded-lg border p-2.5"
                      style={{
                        borderColor: "var(--border-hairline)",
                        backgroundColor: "var(--bg-surface)",
                      }}
                    >
                      <div
                        className="font-bold"
                        style={{ fontSize: "var(--text-meta)" }}
                      >
                        Kin (14)
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        Inner-circle family, co-breeders & local squad
                      </div>
                    </div>
                    <div
                      className="rounded-lg border p-2.5"
                      style={{
                        borderColor: "var(--border-hairline)",
                        backgroundColor: "var(--bg-surface)",
                      }}
                    >
                      <div
                        className="font-bold"
                        style={{ fontSize: "var(--text-meta)" }}
                      >
                        Mentors (29)
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        Verified kennels, master PC builders & chefs
                      </div>
                    </div>
                    <div
                      className="rounded-lg border p-2.5"
                      style={{
                        borderColor: "var(--border-hairline)",
                        backgroundColor: "var(--bg-surface)",
                      }}
                    >
                      <div
                        className="font-bold"
                        style={{ fontSize: "var(--text-meta)" }}
                      >
                        Peers (184)
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        Verified buyers, guild members & home cooks
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* RIGHT PANE: Ambient Telemetry, Cross-Vertical Wallet & See Through Audit */}
              <aside
                className="lg:col-span-3 rounded-2xl border p-4 space-y-4"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Activity
                    className="h-4 w-4"
                    style={{ color: "var(--accent-gold)" }}
                  />
                  <h2
                    className="font-bold"
                    style={{ fontSize: "var(--text-ui)" }}
                  >
                    Right Pane · Ambient Telemetry
                  </h2>
                </div>

                {/* Unified Creator & Brand OS Ledger */}
                <div
                  className="rounded-xl border p-3.5 space-y-2"
                  style={{
                    borderColor: "var(--border-hairline)",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontSize: "var(--text-micro)",
                        color: "var(--fg-smoke)",
                      }}
                    >
                      UNIFIED STRIPE CONNECT LEDGER
                    </span>
                    <Wallet
                      className="h-3.5 w-3.5"
                      style={{ color: "var(--accent-gold)" }}
                    />
                  </div>
                  <div
                    className="font-bold"
                    style={{ fontSize: "var(--text-title)" }}
                  >
                    $1,015.00 Held
                  </div>
                  <p
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--fg-smoke)",
                    }}
                  >
                    • $500 Scrlpets Puppy Deposit (#9041)
                    <br />• $500 {selectedTechName.name} RTX 5090 Rig (#7712)
                    <br />• $15 {selectedFoodName.name} Otates Pickup (#408)
                  </p>
                </div>

                {/* Apotheosis Agent Bus Status */}
                <div
                  className="rounded-xl border p-3.5 space-y-2"
                  style={{
                    borderColor: "var(--border-hairline)",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-semibold"
                      style={{ fontSize: "var(--text-meta)" }}
                    >
                      Apotheosis Agent Bus
                    </span>
                    <Bot
                      className="h-4 w-4"
                      style={{ color: "var(--accent-purple)" }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--fg-smoke)",
                    }}
                  >
                    Safety Net Active: 20 skills synced across Claude Code,
                    Codex CLI, and Antigravity.
                  </p>
                </div>

                {/* See Through Local Audit Log */}
                <div
                  className="rounded-xl border p-3.5 space-y-2"
                  style={{
                    borderColor: "var(--border-hairline)",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-semibold"
                      style={{ fontSize: "var(--text-meta)" }}
                    >
                      See Through Privacy Ledger
                    </span>
                    <Lock
                      className="h-3.5 w-3.5"
                      style={{ color: "var(--status-success)" }}
                    />
                  </div>
                  <ul
                    className="space-y-1.5"
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--fg-smoke)",
                    }}
                  >
                    <li>✓ Keychain token shared locally (0 cloud leak)</li>
                    <li>✓ C2PA hardware & receipt signatures verified</li>
                    <li>✓ Zero third-party ad-broker trackers loaded</li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* =========================================================
            SURFACE 2: VERTICAL #2 — TECH, GAMING & AI WORK STACK
           ========================================================= */}
        {activeSurface === "tech_vertical" && (
          <div className="space-y-6">
            {/* Single-Word Name Taste Switcher */}
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span
                    className="rounded-md px-2 py-0.5 font-semibold"
                    style={{
                      backgroundColor: "var(--accent-purple)",
                      color: "var(--fg-bone)",
                      fontSize: "var(--text-micro)",
                    }}
                  >
                    VERTICAL #2 · SINGLE-WORD BRAND SELECTOR
                  </span>
                  <h1
                    className="font-bold mt-1"
                    style={{ fontSize: "var(--text-title)" }}
                  >
                    ⚡ {selectedTechName.name} — {selectedTechName.tagline}
                  </h1>
                </div>
                <span
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--fg-ash)",
                  }}
                >
                  Filtered by Dailen&apos;s Naming Taste Heuristic (No -Hub,
                  -Lab, -AI, or Neo- prefixes)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {TECH_VERTICAL_NAME_CANDIDATES.map((cand) => {
                  const active = cand.id === selectedTechName.id;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => setSelectedTechNameId(cand.id)}
                      className="rounded-xl border p-3 text-left transition"
                      style={{
                        borderColor: active
                          ? "var(--accent-gold)"
                          : "var(--border-hairline)",
                        backgroundColor: active
                          ? "var(--bg-elevated)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-bold"
                          style={{ fontSize: "var(--text-ui)" }}
                        >
                          {cand.name}
                        </span>
                        {active && (
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--accent-gold)",
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-1"
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        {cand.rationale}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3-Pillar Selector: Hardware Rigs | Gaming, Mods & Streams | AI Work Stack */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setActiveTechPillar("hardware")}
                className="rounded-xl border p-4 text-left transition"
                style={{
                  borderColor:
                    activeTechPillar === "hardware"
                      ? "var(--accent-purple)"
                      : "var(--border-hairline)",
                  backgroundColor:
                    activeTechPillar === "hardware"
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Cpu
                    className="h-4 w-4"
                    style={{ color: "var(--accent-purple)" }}
                  />
                  <span style={{ fontSize: "var(--text-ui)" }}>
                    Pillar 1 · Hardware Rigs & Builds
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Custom PCs, watercooled workstations, GPU serial provenance,
                  and local boot QR escrow.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTechPillar("gaming")}
                className="rounded-xl border p-4 text-left transition"
                style={{
                  borderColor:
                    activeTechPillar === "gaming"
                      ? "var(--accent-purple)"
                      : "var(--border-hairline)",
                  backgroundColor:
                    activeTechPillar === "gaming"
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Gamepad2
                    className="h-4 w-4"
                    style={{ color: "var(--accent-gold)" }}
                  />
                  <span style={{ fontSize: "var(--text-ui)" }}>
                    Pillar 2 · Gaming, Mods & Streams
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Daily gamer habit: 9:16 clips, Hall-Effect controller builds,
                  shader/OBS packs, and RTMP squad streams.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTechPillar("ai_work_stack")}
                className="rounded-xl border p-4 text-left transition"
                style={{
                  borderColor:
                    activeTechPillar === "ai_work_stack"
                      ? "var(--accent-purple)"
                      : "var(--border-hairline)",
                  backgroundColor:
                    activeTechPillar === "ai_work_stack"
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: "var(--status-success)" }}
                  />
                  <span style={{ fontSize: "var(--text-ui)" }}>
                    Pillar 3 · AI Workflows & Agent Stacks
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Verified multi-agent skills, MCP harnesses, prompt canons, and
                  1-tap Synergy installation.
                </p>
              </button>
            </div>

            {/* Active Tech/Gaming/AI Dossier View (100% Cloned from Scrlpets Dossier Architecture) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Dossier Header + Lineage Tree */}
              <div
                className="lg:col-span-7 rounded-2xl border p-5 space-y-5"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className="rounded-md px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor: "var(--bg-elevated)",
                        color: "var(--accent-gold)",
                        fontSize: "var(--text-micro)",
                      }}
                    >
                      {activeTechDossier.pillarLabel}
                    </span>
                    <h2
                      className="font-bold mt-1"
                      style={{ fontSize: "var(--text-title)" }}
                    >
                      {activeTechDossier.title}
                    </h2>
                    <p
                      style={{
                        fontSize: "var(--text-meta)",
                        color: "var(--fg-smoke)",
                      }}
                    >
                      {activeTechDossier.subtitle} · Built by{" "}
                      <strong>{activeTechDossier.builderBrand}</strong> (
                      {activeTechDossier.builderHandle})
                    </p>
                  </div>

                  <div className="text-right">
                    <div
                      className="font-bold"
                      style={{
                        fontSize: "var(--text-title)",
                        color: "var(--accent-gold)",
                      }}
                    >
                      {activeTechDossier.priceFormatted}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-micro)",
                        color: "var(--status-success)",
                      }}
                    >
                      {activeTechDossier.depositFormatted}
                    </div>
                  </div>
                </div>

                <p
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: "var(--border-hairline)",
                    backgroundColor: "var(--bg-elevated)",
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  {activeTechDossier.summary}
                </p>

                {/* Component / Mod / Agent Lineage Tree (Reuses Scrlpets Pedigree Canvas Pattern) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch
                        className="h-4 w-4"
                        style={{ color: "var(--accent-purple)" }}
                      />
                      <h3
                        className="font-bold"
                        style={{ fontSize: "var(--text-ui)" }}
                      >
                        {activeTechDossier.treeTitle}
                      </h3>
                    </div>
                    <span
                      className="rounded-md px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor: "var(--bg-elevated)",
                        color: "var(--status-success)",
                        fontSize: "var(--text-micro)",
                      }}
                    >
                      {activeTechDossier.efficiencyLabel}:{" "}
                      {activeTechDossier.efficiencyValue}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeTechDossier.nodes.map((node) => (
                      <div
                        key={node.id}
                        className="rounded-xl border p-3.5 space-y-1"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-elevated)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--accent-gold)",
                            }}
                          >
                            {node.role}
                          </span>
                          {node.verified && (
                            <span
                              className="inline-flex items-center gap-1"
                              style={{
                                fontSize: "var(--text-micro)",
                                color: "var(--status-success)",
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Verified
                            </span>
                          )}
                        </div>
                        <div
                          className="font-bold"
                          style={{ fontSize: "var(--text-meta)" }}
                        >
                          {node.label}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          {node.spec}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Benchmark Passport + 9:16 Reel Preview + Auto-Connected Messenger CTA */}
              <div
                className="lg:col-span-5 rounded-2xl border p-5 space-y-5 flex flex-col justify-between"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="h-4 w-4"
                      style={{ color: "var(--status-success)" }}
                    />
                    <h3
                      className="font-bold"
                      style={{ fontSize: "var(--text-ui)" }}
                    >
                      {activeTechDossier.passportTitle}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeTechDossier.clearances.map((c) => (
                      <div
                        key={c.label}
                        className="rounded-xl border p-3"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-elevated)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-ash)",
                          }}
                        >
                          {c.label}
                        </div>
                        <div
                          className="font-bold mt-0.5"
                          style={{
                            fontSize: "var(--text-meta)",
                            color:
                              c.status === "elite"
                                ? "var(--accent-gold)"
                                : "var(--status-success)",
                          }}
                        >
                          {c.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Linked 9:16 Proof Reel Card */}
                  <div
                    className="rounded-xl border p-3.5 space-y-1.5"
                    style={{
                      borderColor: "var(--border-hairline)",
                      backgroundColor: "var(--bg-elevated)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--accent-purple)",
                        }}
                      >
                        <Video className="h-3.5 w-3.5" /> 9:16 Proof Reel &
                        Creator Tipping
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-ash)",
                        }}
                      >
                        {activeTechDossier.reelViews}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "var(--text-meta)",
                        color: "var(--fg-bone)",
                      }}
                    >
                      &ldquo;{activeTechDossier.reelCaption}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Auto-Connected Synergy Messenger Handover CTA */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenMessengerWithThread(
                        activeTechDossier.linkedThreadId,
                      )
                    }
                    className="w-full rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 transition hover:opacity-95"
                    style={{
                      backgroundColor: "var(--accent-purple)",
                      color: "var(--fg-bone)",
                      fontSize: "var(--text-ui)",
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message Builder in Synergy Messenger (Deal + QR Pinned)
                  </button>
                  <p
                    className="text-center"
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--fg-ash)",
                    }}
                  >
                    Zero context switching: opens the auto-connected Messenger
                    thread with Held Payment & QR Handover ready.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SURFACE 3: VERTICAL #3 — FOOD REVIEWS, RECIPES & LOCAL EATS
           ========================================================= */}
        {activeSurface === "food_vertical" && (
          <div className="space-y-6">
            {/* Single-Word Name Taste Switcher for Food Vertical */}
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span
                    className="rounded-md px-2 py-0.5 font-semibold"
                    style={{
                      backgroundColor: "var(--accent-gold)",
                      color: "var(--bg-void)",
                      fontSize: "var(--text-micro)",
                    }}
                  >
                    VERTICAL #3 · 3X-A-DAY HABIT & TAQUERIA OTATES ENGINE
                  </span>
                  <h1
                    className="font-bold mt-1"
                    style={{ fontSize: "var(--text-title)" }}
                  >
                    🍽️ {selectedFoodName.name} — {selectedFoodName.tagline}
                  </h1>
                </div>
                <span
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--fg-ash)",
                  }}
                >
                  Reuses Pedigree Canvas for Recipe Trees + QR Escrow for Food
                  Truck Pickup
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {FOOD_VERTICAL_NAME_CANDIDATES.map((cand) => {
                  const active = cand.id === selectedFoodName.id;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => setSelectedFoodNameId(cand.id)}
                      className="rounded-xl border p-3 text-left transition"
                      style={{
                        borderColor: active
                          ? "var(--accent-gold)"
                          : "var(--border-hairline)",
                        backgroundColor: active
                          ? "var(--bg-elevated)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-bold"
                          style={{ fontSize: "var(--text-ui)" }}
                        >
                          {cand.name}
                        </span>
                        {active && (
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--accent-gold)",
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-1"
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        {cand.rationale}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3-Pillar Selector for Food Vertical */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setActiveFoodPillar("local_eats")}
                className="rounded-xl border p-4 text-left transition"
                style={{
                  borderColor:
                    activeFoodPillar === "local_eats"
                      ? "var(--accent-gold)"
                      : "var(--border-hairline)",
                  backgroundColor:
                    activeFoodPillar === "local_eats"
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Utensils
                    className="h-4 w-4"
                    style={{ color: "var(--accent-gold)" }}
                  />
                  <span style={{ fontSize: "var(--text-ui)" }}>
                    Pillar 1 · Verified Local Reviews & Trucks
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Receipt-verified 9:16 food reviews (zero fake bots) +
                  no-show protected QR pickup window.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveFoodPillar("recipes")}
                className="rounded-xl border p-4 text-left transition"
                style={{
                  borderColor:
                    activeFoodPillar === "recipes"
                      ? "var(--accent-gold)"
                      : "var(--border-hairline)",
                  backgroundColor:
                    activeFoodPillar === "recipes"
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <GitBranch
                    className="h-4 w-4"
                    style={{ color: "var(--accent-purple)" }}
                  />
                  <span style={{ fontSize: "var(--text-ui)" }}>
                    Pillar 2 · Forkable Recipe Pedigree Trees
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  See the 1978 family recipe, the smoked pitmaster remix, and
                  interactive portion/macro scaling.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveFoodPillar("chef_drops")}
                className="rounded-xl border p-4 text-left transition"
                style={{
                  borderColor:
                    activeFoodPillar === "chef_drops"
                      ? "var(--accent-gold)"
                      : "var(--border-hairline)",
                  backgroundColor:
                    activeFoodPillar === "chef_drops"
                      ? "var(--bg-elevated)"
                      : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Flame
                    className="h-4 w-4"
                    style={{ color: "var(--status-success)" }}
                  />
                  <span style={{ fontSize: "var(--text-ui)" }}>
                    Pillar 3 · Small-Batch Chef Drops
                  </span>
                </div>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Numbered local drops (chili crisp, smoked plates, baked
                  goods) with Held Payment QR pickup.
                </p>
              </button>
            </div>

            {/* Active Food / Recipe Dossier */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div
                className="lg:col-span-7 rounded-2xl border p-5 space-y-5"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className="rounded-md px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor: "var(--bg-elevated)",
                        color: "var(--accent-gold)",
                        fontSize: "var(--text-micro)",
                      }}
                    >
                      {activeFoodDossier.pillarLabel}
                    </span>
                    <h2
                      className="font-bold mt-1"
                      style={{ fontSize: "var(--text-title)" }}
                    >
                      {activeFoodDossier.title}
                    </h2>
                    <p
                      style={{
                        fontSize: "var(--text-meta)",
                        color: "var(--fg-smoke)",
                      }}
                    >
                      {activeFoodDossier.subtitle} · By{" "}
                      <strong>{activeFoodDossier.creatorBrand}</strong> (
                      {activeFoodDossier.creatorHandle})
                    </p>
                  </div>

                  <div className="text-right">
                    <div
                      className="font-bold"
                      style={{
                        fontSize: "var(--text-title)",
                        color: "var(--accent-gold)",
                      }}
                    >
                      {activeFoodDossier.priceFormatted}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-micro)",
                        color: "var(--status-success)",
                      }}
                    >
                      {activeFoodDossier.depositFormatted}
                    </div>
                  </div>
                </div>

                <p
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: "var(--border-hairline)",
                    backgroundColor: "var(--bg-elevated)",
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  {activeFoodDossier.summary}
                </p>

                {/* Interactive Recipe Servings Scaler when on Recipes Pillar */}
                {activeFoodPillar === "recipes" && (
                  <div
                    className="rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3"
                    style={{
                      borderColor: "var(--accent-purple)",
                      backgroundColor: "var(--bg-elevated)",
                    }}
                  >
                    <div>
                      <div
                        className="font-semibold"
                        style={{ fontSize: "var(--text-meta)" }}
                      >
                        Interactive Portion & Macro Scaler
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        Scaled for{" "}
                        <strong>{recipeServingsScale} servings</strong> · Est.
                        Protein: {58 * (recipeServingsScale / 4)}g total
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[2, 4, 8, 12].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setRecipeServingsScale(count)}
                          className="rounded-lg px-2.5 py-1 font-bold"
                          style={{
                            fontSize: "var(--text-micro)",
                            backgroundColor:
                              recipeServingsScale === count
                                ? "var(--accent-purple)"
                                : "var(--bg-surface)",
                            color: "var(--fg-bone)",
                          }}
                        >
                          {count}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Culinary / Recipe Lineage Tree */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch
                        className="h-4 w-4"
                        style={{ color: "var(--accent-gold)" }}
                      />
                      <h3
                        className="font-bold"
                        style={{ fontSize: "var(--text-ui)" }}
                      >
                        {activeFoodDossier.treeTitle}
                      </h3>
                    </div>
                    <span
                      className="rounded-md px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor: "var(--bg-elevated)",
                        color: "var(--status-success)",
                        fontSize: "var(--text-micro)",
                      }}
                    >
                      {activeFoodDossier.authenticityLabel}:{" "}
                      {activeFoodDossier.authenticityValue}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeFoodDossier.nodes.map((node) => (
                      <div
                        key={node.id}
                        className="rounded-xl border p-3.5 space-y-1"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-elevated)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--accent-gold)",
                            }}
                          >
                            {node.role}
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            style={{
                              fontSize: "var(--text-micro)",
                              color: "var(--status-success)",
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        </div>
                        <div
                          className="font-bold"
                          style={{ fontSize: "var(--text-meta)" }}
                        >
                          {node.label}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-smoke)",
                          }}
                        >
                          {node.spec}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Kitchen Passport + 9:16 Taste Reel + Messenger Pickup CTA */}
              <div
                className="lg:col-span-5 rounded-2xl border p-5 space-y-5 flex flex-col justify-between"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="h-4 w-4"
                      style={{ color: "var(--status-success)" }}
                    />
                    <h3
                      className="font-bold"
                      style={{ fontSize: "var(--text-ui)" }}
                    >
                      {activeFoodDossier.passportTitle}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeFoodDossier.clearances.map((c) => (
                      <div
                        key={c.label}
                        className="rounded-xl border p-3"
                        style={{
                          borderColor: "var(--border-hairline)",
                          backgroundColor: "var(--bg-elevated)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-ash)",
                          }}
                        >
                          {c.label}
                        </div>
                        <div
                          className="font-bold mt-0.5"
                          style={{
                            fontSize: "var(--text-meta)",
                            color:
                              c.status === "elite"
                                ? "var(--accent-gold)"
                                : "var(--status-success)",
                          }}
                        >
                          {c.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="rounded-xl border p-3.5 space-y-1.5"
                    style={{
                      borderColor: "var(--border-hairline)",
                      backgroundColor: "var(--bg-elevated)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--accent-gold)",
                        }}
                      >
                        <Video className="h-3.5 w-3.5" /> 9:16 Receipt-Verified
                        Taste Reel
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-ash)",
                        }}
                      >
                        {activeFoodDossier.reelViews}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "var(--text-meta)",
                        color: "var(--fg-bone)",
                      }}
                    >
                      &ldquo;{activeFoodDossier.reelCaption}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenMessengerWithThread(
                        activeFoodDossier.linkedThreadId,
                      )
                    }
                    className="w-full rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 transition hover:opacity-95"
                    style={{
                      backgroundColor: "var(--accent-purple)",
                      color: "var(--fg-bone)",
                      fontSize: "var(--text-ui)",
                    }}
                  >
                    <QrCode className="h-4 w-4" />
                    Open Order & Pickup QR in Synergy Messenger
                  </button>
                  <p
                    className="text-center"
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--fg-ash)",
                    }}
                  >
                    Scanning the pickup QR at the window releases Held Payment
                    and unlocks your Verified Diner Review badge.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SURFACE 4: STANDALONE AUTO-CONNECTED SYNERGY MESSENGER
           ========================================================= */}
        {activeSurface === "synergy_messenger" && activeThread && (
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: "var(--accent-purple)",
                    color: "var(--fg-bone)",
                  }}
                >
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div>
                  <h1
                    className="font-bold"
                    style={{ fontSize: "var(--text-ui)" }}
                  >
                    Synergy Messenger · Standalone Auto-Connected App
                  </h1>
                  <p
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--fg-smoke)",
                    }}
                  >
                    Auto-signed in via{" "}
                    <code>group.com.blacksheep247.synergy</code> · Color-coded
                    vertical threads with pinned Deal Dossiers & QR Handover
                  </p>
                </div>
              </div>

              {/* Vertical Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "all", label: "All Verticals" },
                    { id: "scrlpets", label: "🐾 Scrlpets" },
                    {
                      id: "tech_gaming",
                      label: `⚡ ${selectedTechName.name}`,
                    },
                    {
                      id: "food_recipes",
                      label: `🍽️ ${selectedFoodName.name}`,
                    },
                  ] as { id: MessengerVerticalFilter; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMessengerFilter(tab.id)}
                    className="rounded-lg border px-2.5 py-1 font-medium"
                    style={{
                      fontSize: "var(--text-micro)",
                      borderColor:
                        messengerFilter === tab.id
                          ? "var(--accent-purple)"
                          : "var(--border-hairline)",
                      backgroundColor:
                        messengerFilter === tab.id
                          ? "var(--accent-purple)"
                          : "var(--bg-elevated)",
                      color: "var(--fg-bone)",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 4 Cols: Unified Multi-Vertical Thread List */}
              <aside
                className="lg:col-span-4 rounded-2xl border p-4 space-y-2.5"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <div
                  className="font-semibold px-1"
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--fg-smoke)",
                  }}
                >
                  Active Ecosystem Threads ({filteredThreads.length})
                </div>

                {filteredThreads.map((thread) => {
                  const selected = thread.id === activeThread.id;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setActiveThreadId(thread.id)}
                      className="w-full rounded-xl border p-3 text-left transition space-y-1.5"
                      style={{
                        borderColor: selected
                          ? "var(--accent-purple)"
                          : "var(--border-hairline)",
                        backgroundColor: selected
                          ? "var(--bg-elevated)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 font-semibold"
                          style={{
                            backgroundColor: "var(--bg-surface)",
                            color: "var(--accent-gold)",
                            fontSize: "var(--text-micro)",
                          }}
                        >
                          {thread.verticalBadge}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--fg-ash)",
                          }}
                        >
                          {thread.timestamp}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className="font-bold"
                          style={{ fontSize: "var(--text-meta)" }}
                        >
                          {thread.counterpartyName}{" "}
                          <span
                            style={{
                              fontWeight: 400,
                              color: "var(--fg-ash)",
                            }}
                          >
                            {thread.counterpartyHandle}
                          </span>
                        </span>
                      </div>

                      <p
                        className="line-clamp-2"
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        {thread.lastMessage}
                      </p>
                    </button>
                  );
                })}
              </aside>

              {/* Right 8 Cols: Active Conversation + Pinned Server-Driven Deal Dossier Card */}
              <section
                className="lg:col-span-8 rounded-2xl border p-5 flex flex-col justify-between space-y-4"
                style={{
                  borderColor: "var(--border-hairline)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                {/* Pinned Context-Preserving Deal Dossier Card */}
                <div
                  className="rounded-xl border p-4 space-y-3"
                  style={{
                    borderColor: "var(--accent-purple)",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-2 py-0.5 font-bold"
                          style={{
                            backgroundColor: "var(--accent-purple)",
                            color: "var(--fg-bone)",
                            fontSize: "var(--text-micro)",
                          }}
                        >
                          PINNED {activeThread.verticalBadge.toUpperCase()}{" "}
                          DOSSIER
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-micro)",
                            color: "var(--status-success)",
                          }}
                        >
                          {activeThread.dealCard.status === "released"
                            ? "✅ Funds Released via QR Handover"
                            : `🔒 ${activeThread.dealCard.heldAmountFormatted}`}
                        </span>
                      </div>
                      <h2
                        className="font-bold mt-1"
                        style={{ fontSize: "var(--text-ui)" }}
                      >
                        {activeThread.dealCard.itemTitle}
                      </h2>
                      <p
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-smoke)",
                        }}
                      >
                        {activeThread.dealCard.itemSubtitle}
                      </p>
                    </div>

                    <div className="text-right">
                      <div
                        className="font-bold"
                        style={{
                          fontSize: "var(--text-ui)",
                          color: "var(--accent-gold)",
                        }}
                      >
                        {activeThread.dealCard.priceFormatted}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-micro)",
                          color: "var(--fg-ash)",
                        }}
                      >
                        PIN: {activeThread.dealCard.handoverPin}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t"
                    style={{ borderColor: "var(--border-hairline)" }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-micro)",
                        color: "var(--fg-smoke)",
                      }}
                    >
                      {activeThread.dealCard.passportSummary}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQrModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold"
                        style={{
                          backgroundColor:
                            activeThread.dealCard.status === "released"
                              ? "var(--bg-surface)"
                              : "var(--accent-gold)",
                          color:
                            activeThread.dealCard.status === "released"
                              ? "var(--fg-bone)"
                              : "var(--bg-void)",
                          fontSize: "var(--text-micro)",
                        }}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        {activeThread.dealCard.status === "released"
                          ? "View Completed QR Receipt"
                          : "In-Person QR Handover"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chat Messages Stream */}
                <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
                  {activeThread.messages.map((msg) => {
                    const isMe = msg.sender === "me";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className="max-w-md rounded-2xl px-3.5 py-2.5 space-y-1"
                          style={{
                            backgroundColor: isMe
                              ? "var(--accent-purple)"
                              : "var(--bg-elevated)",
                            color: "var(--fg-bone)",
                          }}
                        >
                          <p style={{ fontSize: "var(--text-meta)" }}>
                            {msg.text}
                          </p>
                          <div
                            className="text-right"
                            style={{
                              fontSize: "var(--text-micro)",
                              opacity: 0.75,
                            }}
                          >
                            {msg.time}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 pt-2 border-t"
                  style={{ borderColor: "var(--border-hairline)" }}
                >
                  <input
                    type="text"
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    placeholder={`Reply as ${currentPersonaObj.handle} in Synergy Messenger...`}
                    className="flex-1 rounded-xl border px-3.5 py-2 outline-none"
                    style={{
                      borderColor: "var(--border-hairline)",
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--fg-bone)",
                      fontSize: "var(--text-meta)",
                    }}
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-semibold"
                    style={{
                      backgroundColor: "var(--accent-purple)",
                      color: "var(--fg-bone)",
                      fontSize: "var(--text-meta)",
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* In-Person QR Handover Modal inside Synergy Messenger */}
      {qrModalOpen && activeThread && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--bg-void) 80%, transparent)",
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4"
            style={{
              borderColor: "var(--accent-gold)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="rounded-md px-2 py-0.5 font-bold"
                style={{
                  backgroundColor: "var(--accent-gold)",
                  color: "var(--bg-void)",
                  fontSize: "var(--text-micro)",
                }}
              >
                SYNERGY MESSENGER · QR ESCROW HANDOVER
              </span>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                style={{
                  fontSize: "var(--text-meta)",
                  color: "var(--fg-smoke)",
                }}
              >
                Close ✕
              </button>
            </div>

            <div className="space-y-1">
              <h3
                className="font-bold"
                style={{ fontSize: "var(--text-ui)" }}
              >
                {activeThread.dealCard.itemTitle}
              </h3>
              <p
                style={{
                  fontSize: "var(--text-micro)",
                  color: "var(--fg-smoke)",
                }}
              >
                Have {activeThread.counterpartyName} scan this QR code or enter
                the 6-digit PIN once you verify the handover in person.
              </p>
            </div>

            {/* Deterministic SVG QR Code Representation */}
            <div
              className="mx-auto flex flex-col items-center justify-center rounded-xl border p-4 space-y-2"
              style={{
                borderColor: "var(--border-hairline)",
                backgroundColor: "var(--bg-elevated)",
              }}
            >
              <QrCode
                className="h-28 w-28"
                style={{ color: "var(--fg-bone)" }}
              />
              <code
                className="rounded px-2 py-0.5 font-mono"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--accent-gold)",
                  fontSize: "var(--text-micro)",
                }}
              >
                {activeThread.dealCard.handoverQrPayload}
              </code>
              <div
                className="font-mono font-bold tracking-widest"
                style={{ fontSize: "var(--text-title)" }}
              >
                PIN: {activeThread.dealCard.handoverPin}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {activeThread.dealCard.status !== "released" ? (
                <button
                  type="button"
                  onClick={() => handleReleaseHandover(activeThread.id)}
                  className="w-full rounded-xl py-2.5 font-bold"
                  style={{
                    backgroundColor: "var(--status-success)",
                    color: "var(--bg-void)",
                    fontSize: "var(--text-meta)",
                  }}
                >
                  Simulate In-Person QR Scan & Release Held Funds
                </button>
              ) : (
                <div
                  className="w-full text-center font-semibold py-2"
                  style={{
                    color: "var(--status-success)",
                    fontSize: "var(--text-meta)",
                  }}
                >
                  ✅ Handover Complete — Funds Released to Seller
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
