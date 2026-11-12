"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TreeCreature, TreeGeneration } from "@/lib/tree/queries";
import { TreeCard } from "./TreeCard";

type Line = { x1: number; y1: number; x2: number; y2: number };

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function TreeCanvas({
  generations,
  creatures,
  canManage,
}: {
  generations: TreeGeneration[];
  creatures: TreeCreature[];
  canManage: boolean;
}) {
  const t = useTranslations("tree");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "breeding" | "founders" | "roster" | "memorials" | "males" | "females"
  >("all");

  const edges = useMemo(() => {
    const list: { childId: string; parentId: string }[] = [];
    for (const creature of creatures) {
      if (creature.sireId) list.push({ childId: creature.id, parentId: creature.sireId });
      if (creature.damId) list.push({ childId: creature.id, parentId: creature.damId });
    }
    return list;
  }, [creatures]);

  const isMatch = useCallback(
    (c: TreeCreature) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(q);
        const breedMatch = c.breed ? c.breed.toLowerCase().includes(q) : false;
        const speciesMatch = c.species ? c.species.toLowerCase().includes(q) : false;
        if (!nameMatch && !breedMatch && !speciesMatch) return false;
      }
      if (activeFilter === "breeding") return c.creatureRole === "breeding";
      if (activeFilter === "founders") return c.isFounder;
      if (activeFilter === "roster") return c.inRoster;
      if (activeFilter === "memorials") return !!c.deceasedAt;
      if (activeFilter === "males") return c.gender === "male";
      if (activeFilter === "females") return c.gender === "female";
      return true;
    },
    [searchQuery, activeFilter],
  );

  const isFiltering = searchQuery.trim() !== "" || activeFilter !== "all";
  const matchCount = useMemo(() => {
    if (!isFiltering) return creatures.length;
    return creatures.filter(isMatch).length;
  }, [creatures, isMatch, isFiltering]);

  // Reading order for arrow-key focus movement: generation row, then each
  // row's own creature order — matches what's actually rendered left-to-right.
  const order = useMemo(() => generations.flatMap((g) => g.creatures.map((c) => c.id)), [generations]);

  const setCardRef = useCallback((id: string, el: HTMLAnchorElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerBox = container.getBoundingClientRect();
    const nextLines: Line[] = [];
    for (const edge of edges) {
      const child = cardRefs.current.get(edge.childId);
      const parent = cardRefs.current.get(edge.parentId);
      if (!child || !parent) continue;
      const childBox = child.getBoundingClientRect();
      const parentBox = parent.getBoundingClientRect();
      nextLines.push({
        x1: parentBox.left + parentBox.width / 2 - containerBox.left,
        y1: parentBox.bottom - containerBox.top,
        x2: childBox.left + childBox.width / 2 - containerBox.left,
        y2: childBox.top - containerBox.top,
      });
    }
    setLines(nextLines);
    setBox({ width: container.scrollWidth, height: container.scrollHeight });
  }, [edges]);

  useLayoutEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;
    // ponytail: scroll events don't bubble, but a capture-phase listener on
    // the container still sees every descendant row's scroll — one listener
    // instead of wiring up each row.
    container.addEventListener("scroll", recompute, { capture: true, passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      container.removeEventListener("scroll", recompute, { capture: true });
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!NEXT_KEYS.has(event.key) && !PREV_KEYS.has(event.key)) return;
    const active = document.activeElement;
    const currentId = [...cardRefs.current.entries()].find(([, el]) => el === active)?.[0];
    if (!currentId) return;
    const index = order.indexOf(currentId);
    const nextIndex = index + (NEXT_KEYS.has(event.key) ? 1 : -1);
    if (nextIndex < 0 || nextIndex >= order.length) return;
    event.preventDefault();
    cardRefs.current.get(order[nextIndex])?.focus();
  }

  if (generations.length === 0) {
    return (
      <section className="px-3 py-10 text-center" data-testid="tree-empty">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="relative px-3 pb-6" onKeyDown={onKeyDown} data-testid="tree-canvas">
      {/* Interactive Lineage Filter & Search Toolbar */}
      <div className="mb-5 space-y-2.5 rounded-2xl border border-border/60 bg-card/40 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-brand-link" />
            <span>Pedigree Intelligence & Filters</span>
          </div>
          {isFiltering && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-micro font-medium text-primary">
              Showing {matchCount} of {creatures.length} animals
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name, breed, or line..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-8 w-full rounded-xl border border-input bg-background/80 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1 text-micro font-medium">
            {[
              { id: "all", label: "All Stock" },
              { id: "breeding", label: "Breeding Only" },
              { id: "founders", label: "Founders" },
              { id: "roster", label: "Active Roster" },
              { id: "memorials", label: "Memorials" },
              { id: "males", label: "Sires ♂" },
              { id: "females", label: "Dams ♀" },
            ].map((f) => {
              const selected = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id as typeof activeFilter)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    selected
                      ? "border border-primary bg-primary/15 font-semibold text-primary"
                      : "border border-border/70 bg-background/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={box.width}
        height={box.height}
        aria-hidden
        data-testid="tree-connectors"
      >
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="stroke-primary/45 dark:stroke-primary/65"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        ))}
      </svg>

      {generations.map((row) => (
        <div key={row.generation} className="relative mb-6" data-testid="tree-generation-row">
          <span
            className="mb-2 inline-block rounded-full border border-secondary/40 bg-secondary/20 px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
            data-testid="tree-generation-pill"
          >
            {t("generationLabel", { number: row.generation })}
          </span>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {row.creatures.map((creature) => (
              <TreeCard
                key={creature.id}
                creature={creature}
                canManage={canManage}
                allCreatures={creatures}
                registerRef={setCardRef}
                isDimmed={isFiltering && !isMatch(creature)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
