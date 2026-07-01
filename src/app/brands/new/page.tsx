import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { CreateBrandForm } from "@/components/brand/CreateBrandForm";

export default function NewBrandPage() {
  return (
    <AppPage showBottomNav={false}>
      <section className="px-3 pb-3 pt-4">
        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Brand</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create a brand</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A brand lets you post and list as a kennel, shop, rescue, or business you own.
              </p>
            </div>
            <Link href="/compose" className="rounded-md border border-input px-3 py-2 text-sm font-medium text-brand-link" aria-label="Back to composer">
              Composer
            </Link>
          </div>
        </div>
      </section>
      <section className="px-3 pb-24">
        <div className="premium-panel rounded-2xl p-4">
          <CreateBrandForm />
        </div>
      </section>
    </AppPage>
  );
}
