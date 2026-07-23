"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLitter, createService } from "@/lib/subjects/actions";
import { canManageBrandContent, type BrandRole } from "@/lib/brands/types";
import type { SubjectEntity } from "@/lib/subjects/queries";

// Slice C scope A: name-only litter/service creation so the composer's
// subject picker has real entities to reference.
function SubjectList({
  kind,
  label,
  entities,
  brandId,
  canCreate,
}: {
  kind: "litter" | "service";
  label: string;
  entities: SubjectEntity[];
  brandId: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("name", name.trim());
    form.set("brandId", brandId);
    const result = kind === "litter" ? await createLitter(form) : await createService(form);
    setBusy(false);
    if (!result.ok) {
      setError("Could not add. Try again.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <div data-testid={`brand-${kind}s`}>
      <p className="eyebrow mb-2">{label}</p>
      {entities.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {entities.map((entity) => (
            <li
              key={entity.id}
              className="rounded-full border border-border/70 bg-muted/35 px-3 py-1.5 text-sm"
              data-testid={`${kind}-chip`}
            >
              {entity.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-muted-foreground">None yet.</p>
      )}
      {canCreate && (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={kind === "litter" ? "Litter name" : "Service name"}
            aria-label={kind === "litter" ? "Litter name" : "Service name"}
            data-testid={`new-${kind}-name`}
            className="min-h-11 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !name.trim()}
            data-testid={`add-${kind}`}
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubjectEntitiesPanel({
  brandId,
  viewerRole,
  litters,
  services,
}: {
  brandId: string;
  viewerRole: BrandRole;
  litters: SubjectEntity[];
  services: SubjectEntity[];
}) {
  const canCreate = canManageBrandContent(viewerRole);
  return (
    <div className="premium-panel space-y-4 rounded-2xl p-4" data-testid="subject-entities-panel">
      <SubjectList kind="litter" label="Litters" entities={litters} brandId={brandId} canCreate={canCreate} />
      <SubjectList kind="service" label="Services" entities={services} brandId={brandId} canCreate={canCreate} />
    </div>
  );
}
