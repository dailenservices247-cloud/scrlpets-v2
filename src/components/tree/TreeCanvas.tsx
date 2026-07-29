"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { TreeCreature, TreeGeneration } from "@/lib/tree/queries";
import { TreeCard } from "./TreeCard";

type Line = { x1: number; y1: number; x2: number; y2: number };

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Renders every generation as its own horizontally-scrolling row (robust at
 * 390px — one huge generation never widens the whole page), plus an SVG
 * overlay of parent→child connector lines measured from card refs.
 *
 * Each row scrolls independently, but getBoundingClientRect() always returns
 * true viewport coordinates regardless of which ancestor scrolled, so
 * recomputing on any scroll (own container, capture-phase, so it also catches
 * every row's internal scroll) plus window resize keeps the lines correct
 * without tracking each row's scroll offset by hand.
 */
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

  const edges = useMemo(() => {
    const list: { childId: string; parentId: string }[] = [];
    for (const creature of creatures) {
      if (creature.sireId) list.push({ childId: creature.id, parentId: creature.sireId });
      if (creature.damId) list.push({ childId: creature.id, parentId: creature.damId });
    }
    return list;
  }, [creatures]);

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
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={box.width}
        height={box.height}
        aria-hidden
        data-testid="tree-connectors"
      >
        {lines.map((line, i) => (
          <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="var(--border)" strokeWidth={2} />
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
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
