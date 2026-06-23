import Link from "next/link";
import { ArrowRight, PackageSearch, PawPrint } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";

export default function ShopPage() {
  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">Shop</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Care paths</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Product recommendations will connect to the animals and sellers behind them.
        </p>
      </section>

      <section className="px-4">
        <div className="premium-panel rounded-2xl p-5" data-testid="shop-placeholder">
          <div className="mb-5 grid size-14 place-items-center rounded-full bg-accent/15 text-[color:var(--brand-gold-bright)]">
            <PackageSearch className="size-6" aria-hidden />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Shop foundation</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This area stays truthful until real product inventory, recommendations, and checkout rules are ready.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground"
          >
            Return to feed
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="rounded-2xl border border-secondary/35 bg-secondary/10 p-4">
          <div className="flex gap-3">
            <PawPrint className="mt-0.5 size-5 text-secondary-foreground" aria-hidden />
            <p className="text-sm leading-6 text-muted-foreground">
              Next shop pass should attach products to animals, sellers, and recommendation context.
            </p>
          </div>
        </div>
      </section>
    </AppPage>
  );
}
