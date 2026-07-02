import Link from "next/link";
import { Building2 } from "lucide-react";
import type { MyBrand } from "@/lib/brands/queries";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";
import { Card } from "@/components/ui/card";

function typeLabel(value: string): string {
  return BRAND_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "Brand";
}

/** Real managed brands owned by this profile — renders nothing when there are none. */
export function ProfileIdentityPanel({ brands }: { brands: MyBrand[] }) {
  if (brands.length === 0) return null;

  return (
    <section className="px-3 pt-4" data-testid="profile-identity-panel">
      <Card className="premium-panel gap-3 rounded-2xl p-4" data-testid="managed-brand-card">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent/35 bg-accent/15 text-accent">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{brands.length === 1 ? "Managed brand" : "Managed brands"}</p>
            <div className="mt-2 grid gap-2">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/b/${brand.slug}`}
                  className="group rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-accent/60 hover:bg-muted/45 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <h2 className="truncate text-base font-semibold">{brand.name}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{typeLabel(brand.brandType)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
