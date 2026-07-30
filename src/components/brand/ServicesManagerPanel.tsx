"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaInput } from "@/components/compose/MediaInput";
import { formatPrice } from "@/lib/shop/format";
import { SERVICE_CATEGORIES } from "@/lib/services/categories";
import {
  createProviderService,
  setServiceActive,
  updateProviderService,
} from "@/lib/services/actions";
import type { MyService } from "@/lib/services/queries";

// R16 operator-scoped module: the services YOU own, personal or brand-attached.
// Edit rights follow ownership (RLS "owner updates services"), so everything
// listed here is editable by the viewer. This is the ONLY service creation
// path — B.5/R3 deleted the name-only stub creator that used to shadow it.
type ServiceFormValues = {
  name: string;
  category: string;
  price: string;
  area: string;
  description: string;
  contactNote: string;
  mediaUrl: string;
  brandId: string;
};

const EMPTY_FORM: ServiceFormValues = {
  name: "",
  category: "",
  price: "",
  area: "",
  description: "",
  contactNote: "",
  mediaUrl: "",
  brandId: "",
};

function toForm(service: MyService): ServiceFormValues {
  return {
    name: service.name,
    category: service.category ?? "",
    price: service.priceCents !== null ? (service.priceCents / 100).toFixed(2) : "",
    area: service.area ?? "",
    description: service.description ?? "",
    contactNote: service.contactNote ?? "",
    mediaUrl: service.mediaUrl ?? "",
    brandId: service.brand?.id ?? "",
  };
}

function ServiceForm({
  idPrefix,
  values,
  onChange,
  brands,
  showBrandPicker,
  userId,
}: {
  idPrefix: string;
  values: ServiceFormValues;
  onChange: (next: ServiceFormValues) => void;
  brands: { id: string; name: string }[];
  showBrandPicker: boolean;
  userId: string;
}) {
  const t = useTranslations("services");
  const set = (key: keyof ServiceFormValues) => (value: string) =>
    onChange({ ...values, [key]: value });
  const field =
    "min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm";
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("manage.name")}
        <input
          value={values.name}
          maxLength={80}
          required
          onChange={(e) => set("name")(e.target.value)}
          data-testid={`${idPrefix}-name`}
          className={field}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("manage.category")}
          <select
            value={values.category}
            onChange={(e) => set("category")(e.target.value)}
            data-testid={`${idPrefix}-category`}
            className={field}
          >
            <option value="">{t("manage.noCategory")}</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("manage.price")}
          <input
            value={values.price}
            inputMode="decimal"
            placeholder={t("manage.priceHint")}
            onChange={(e) => set("price")(e.target.value)}
            data-testid={`${idPrefix}-price`}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("manage.area")}
        <input
          value={values.area}
          maxLength={120}
          onChange={(e) => set("area")(e.target.value)}
          data-testid={`${idPrefix}-area`}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("manage.description")}
        <textarea
          value={values.description}
          maxLength={1000}
          onChange={(e) => set("description")(e.target.value)}
          data-testid={`${idPrefix}-description`}
          className="min-h-20 w-full rounded-xl border border-input bg-transparent p-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("manage.contactNote")}
        <input
          value={values.contactNote}
          maxLength={300}
          onChange={(e) => set("contactNote")(e.target.value)}
          data-testid={`${idPrefix}-contact`}
          className={field}
        />
      </label>
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        {t("manage.photo")}
        {values.mediaUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={values.mediaUrl}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
              data-testid={`${idPrefix}-photo-current`}
            />
            <button
              type="button"
              onClick={() => set("mediaUrl")("")}
              className="text-sm font-normal text-muted-foreground underline"
              data-testid={`${idPrefix}-photo-remove`}
            >
              {t("manage.photoRemove")}
            </button>
          </div>
        )}
        <MediaInput
          userId={userId}
          onUploaded={(url, kind) => set("mediaUrl")(kind === "video" ? "" : (url ?? ""))}
        />
        {/* ponytail: MediaInput is the shared picker and also takes video; a
            service card shows a still, so a video upload lands as no photo. */}
      </div>
      {showBrandPicker && brands.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("manage.brand")}
          <select
            value={values.brandId}
            onChange={(e) => set("brandId")(e.target.value)}
            data-testid={`${idPrefix}-brand`}
            className={field}
          >
            <option value="">{t("manage.personal")}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function serviceFormData(values: ServiceFormValues): FormData {
  const fd = new FormData();
  fd.set("name", values.name);
  fd.set("category", values.category);
  fd.set("price", values.price);
  fd.set("area", values.area);
  fd.set("description", values.description);
  fd.set("contactNote", values.contactNote);
  fd.set("mediaUrl", values.mediaUrl);
  fd.set("brandId", values.brandId);
  return fd;
}

export function ServicesManagerPanel({
  services,
  brands,
  userId,
}: {
  services: MyService[];
  brands: { id: string; name: string }[];
  userId: string;
}) {
  const t = useTranslations("services");
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createValues, setCreateValues] = useState<ServiceFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ServiceFormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run(action: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    setError(false);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="services-manager">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl border border-secondary/35 bg-secondary/20 text-secondary-foreground">
          <Scissors className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t("manage.eyebrow")}</p>
          <h2 className="text-lg font-semibold">{t("manage.title")}</h2>
        </div>
        <Link href="/services" className="shrink-0 text-sm text-brand-link underline">
          {t("manage.browseLink")}
        </Link>
      </div>

      {services.length === 0 && !creating && (
        <p className="mb-3 text-sm text-muted-foreground" data-testid="services-manager-empty">
          {t("manage.empty")}
        </p>
      )}

      {services.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="rounded-xl border border-border/70 bg-muted/25 p-3"
              data-testid="my-service-row"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{service.name}</span>
                {service.category && (
                  <span className="eyebrow">{t(`category.${service.category}`)}</span>
                )}
                {service.brand && (
                  <span className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground">
                    {service.brand.name}
                  </span>
                )}
                <span
                  className={
                    service.active
                      ? "rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
                      : "rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground"
                  }
                  data-testid={service.active ? "service-live-chip" : "service-retired-chip"}
                >
                  {service.active ? t("manage.activeChip") : t("manage.retired")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {service.priceCents !== null && service.priceCents > 0
                  ? formatPrice(service.priceCents, "usd")
                  : t("contactForQuote")}
                {service.area ? ` · ${service.area}` : ""}
              </p>

              {editingId === service.id ? (
                <div className="mt-3">
                  <ServiceForm
                    idPrefix="svc-edit"
                    values={editValues}
                    onChange={setEditValues}
                    brands={brands}
                    showBrandPicker={false}
                    userId={userId}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      disabled={busy || !editValues.name.trim()}
                      data-testid="svc-edit-save"
                      onClick={async () => {
                        const ok = await run(() =>
                          updateProviderService(service.id, serviceFormData(editValues)),
                        );
                        if (ok) setEditingId(null);
                      }}
                    >
                      {t("manage.save")}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setEditingId(null)}>
                      {t("manage.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="svc-edit-open"
                    onClick={() => {
                      setEditingId(service.id);
                      setEditValues(toForm(service));
                      setError(false);
                    }}
                  >
                    {t("manage.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    data-testid={service.active ? "service-retire" : "service-reactivate"}
                    onClick={() => run(() => setServiceActive(service.id, !service.active))}
                  >
                    {service.active ? t("manage.retire") : t("manage.reactivate")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
          <ServiceForm
            idPrefix="svc-new"
            values={createValues}
            onChange={setCreateValues}
            brands={brands}
            showBrandPicker
            userId={userId}
          />
          <div className="mt-3 flex gap-2">
            <Button
              disabled={busy || !createValues.name.trim()}
              data-testid="svc-new-submit"
              onClick={async () => {
                const ok = await run(() =>
                  createProviderService(serviceFormData(createValues)),
                );
                if (ok) {
                  setCreating(false);
                  setCreateValues(EMPTY_FORM);
                }
              }}
            >
              {t("manage.create")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setCreating(false)}>
              {t("manage.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          data-testid="offer-service"
          onClick={() => {
            setCreating(true);
            setError(false);
          }}
        >
          {t("manage.offer")}
        </Button>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert" data-testid="service-manage-error">
          {t("manage.error")}
        </p>
      )}
    </div>
  );
}
