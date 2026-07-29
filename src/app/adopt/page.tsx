import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { formatPrice } from "@/lib/shop/format";
import { listAdoptions } from "@/lib/adoption/queries";

export const dynamic = "force-dynamic";


export const metadata = {
  title: "Adoption & rehoming",
  description: "Animals looking for a new home on Scrlpets.",
};

// R17: same entity, same gate as a sale. Only the intent differs.
export default async function AdoptPage() {
  const t = await getTranslations("adopt");
  const listings = await listAdoptions();

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="adopt-gate-notice">
          {t("gateNotice")}
        </p>
      </section>

      <div className="px-4 pb-8">
        {listings.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="adopt-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="adopt-grid">
            {listings.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/listing/${l.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-primary/40"
                  data-testid="adopt-card"
                >
                  {l.mediaUrl || l.creature?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.mediaUrl ?? l.creature!.avatarUrl!}
                      alt=""
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-semibold">{l.creature?.name ?? l.title}</p>
                    {l.creature?.species && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{l.creature.species}</p>
                    )}
                    {l.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {l.description}
                      </p>
                    )}
                    <p className="mt-auto pt-3 text-sm font-semibold">
                      {l.priceCents > 0 ? t("feeAmount", { amount: formatPrice(l.priceCents, l.currency) }) : t("noFee")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{l.sellerUsername ?? "—"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppPage>
  );
}
