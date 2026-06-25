import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Handshake, ShieldCheck, UsersRound } from "lucide-react";
import type { ProfileIdentityModel } from "@/lib/profile-identity";
import { Card } from "@/components/ui/card";

export function ProfileIdentityPanel({ model }: { model: ProfileIdentityModel }) {
  if (model.brands.length === 0 && model.packRelationships.length === 0) return null;

  return (
    <section className="px-3 pt-4" data-testid="profile-identity-panel">
      <div className="grid gap-3">
        {model.brands.length > 0 && (
          <Card className="premium-panel gap-3 rounded-2xl p-4" data-testid="managed-brand-card">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent/35 bg-accent/15 text-accent">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Managed brand</p>
                <div className="mt-2 grid gap-3">
                  {model.brands.map((brand) => (
                    <Link
                      key={brand.slug}
                      href={`/b/${brand.slug}`}
                      className="group rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-accent/60 hover:bg-muted/45 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold">{brand.name}</h2>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {brand.kind} / {brand.handle}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border border-primary/35 bg-primary/15 px-2 py-1 text-xs font-semibold text-brand-link">
                          {brand.role}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{brand.description}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <MiniMetric icon={<UsersRound className="size-4" />} label="Members" value={brand.memberCount} />
                        <MiniMetric icon={<Handshake className="size-4" />} label="Pack" value={brand.packCount} />
                        <MiniMetric icon={<ShieldCheck className="size-4" />} label="Partners" value={brand.collaboratorCount} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {model.packRelationships.length > 0 && (
          <Card className="premium-panel gap-3 rounded-2xl p-4" data-testid="pack-relationship-card">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-secondary/35 bg-secondary/20 text-secondary-foreground">
                <Handshake className="size-5" aria-hidden />
              </span>
              <div>
                <p className="eyebrow">Pack relationships</p>
                <h2 className="text-base font-semibold">Relationship layer, not permissions</h2>
              </div>
            </div>
            <div className="grid gap-2">
              {model.packRelationships.map((relationship) => (
                <div key={relationship.label} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{relationship.label}</span>
                    <span className="text-lg font-semibold text-secondary-foreground">{relationship.value}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{relationship.context}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <span className="rounded-lg border border-border/60 bg-background/20 px-2 py-2">
      <span className="mx-auto grid size-5 place-items-center text-muted-foreground">{icon}</span>
      <span className="mt-1 block text-sm font-semibold">{value}</span>
      <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}
