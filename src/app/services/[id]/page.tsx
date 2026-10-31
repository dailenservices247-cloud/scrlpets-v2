import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppPage } from "@/components/app/AppPage";
import { getServiceById } from "@/lib/services/queries";
import { getSessionUser } from "@/lib/auth/session";
import { ServiceDetailView } from "@/components/services/ServiceDetailView";
import { formatPrice } from "@/lib/shop/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const service = await getServiceById(id);
  if (!service) return { title: "Service Not Found" };

  const priceText =
    service.priceCents !== null
      ? `Starting at ${formatPrice(service.priceCents, service.currency)}`
      : "Custom Quote";

  return {
    title: `${service.name} | Scrlpets Services`,
    description: service.description?.slice(0, 160) ?? `${service.name} on Scrlpets. ${priceText}.`,
    openGraph: {
      title: `${service.name} | Scrlpets Services`,
      description: service.description?.slice(0, 160) ?? `${service.name} on Scrlpets. ${priceText}.`,
      images: service.mediaUrl ? [{ url: service.mediaUrl }] : undefined,
    },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id);
  if (!service) notFound();

  const user = await getSessionUser();

  return (
    <AppPage>
      <ServiceDetailView service={service} viewerId={user?.id} />
    </AppPage>
  );
}
