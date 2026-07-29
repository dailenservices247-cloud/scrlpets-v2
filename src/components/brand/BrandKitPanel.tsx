"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { uploadPhoto } from "@/lib/media/upload";
import { canManageBrandContent, type BrandRole } from "@/lib/brands/types";
import {
  updateBrandKit,
  addGalleryPhoto,
  updateGalleryCaption,
  deleteGalleryPhoto,
} from "@/lib/brand-kit/actions";
import type { BrandKit, BrandGalleryPhoto } from "@/lib/brand-kit/queries";

const GALLERY_CAP = 12;
const TODAY = new Date().toISOString().slice(0, 10);

/** Brand OS management panel for the identity kit (tagline/founded/philosophy/
 * years/specialties) and the facility gallery. Mounted by brand-os/page.tsx
 * alongside the existing BrandIdentityPanel (banner/avatar). */
export function BrandKitPanel({
  brandId,
  brandSlug,
  viewerId,
  viewerRole,
  kit,
  gallery,
}: {
  brandId: string;
  brandSlug: string;
  viewerId: string;
  viewerRole: BrandRole;
  kit: BrandKit;
  gallery: BrandGalleryPhoto[];
}) {
  const t = useTranslations("brandKit");
  const router = useRouter();

  const [specialties, setSpecialties] = useState<string[]>(kit.specialties);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [galleryList, setGalleryList] = useState(gallery);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!canManageBrandContent(viewerRole)) return null;

  function addSpecialty() {
    const value = specialtyInput.trim();
    setSpecialtyInput("");
    if (!value || specialties.includes(value)) return;
    setSpecialties([...specialties, value]);
  }

  async function submitKit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSaved(false);
    specialties.forEach((s) => formData.append("specialties", s));
    const result = await updateBrandKit(brandId, brandSlug, formData);
    setBusy(false);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function upload(file: File | null) {
    if (!file) return;
    if (galleryList.length >= GALLERY_CAP) {
      setGalleryError(t("galleryFull"));
      return;
    }
    setUploadBusy(true);
    setGalleryError(null);
    const result = await uploadPhoto(file, viewerId);
    if ("error" in result) {
      setUploadBusy(false);
      setGalleryError(result.error === "size" ? t("photoTooLarge") : t("error"));
      return;
    }
    const form = new FormData();
    form.set("photoUrl", result.url);
    const saveResult = await addGalleryPhoto(brandId, brandSlug, form);
    setUploadBusy(false);
    if (!saveResult.ok) {
      setGalleryError(t("error"));
      return;
    }
    router.refresh();
  }

  async function saveCaption(photoId: string) {
    const draft = captionDrafts[photoId];
    if (draft === undefined) return;
    const caption = draft.trim() || null;
    const result = await updateGalleryCaption(photoId, brandSlug, caption);
    if (result.ok) {
      setGalleryList((list) => list.map((p) => (p.id === photoId ? { ...p, caption } : p)));
    }
  }

  async function confirmDeletePhoto() {
    if (!deleteId) return;
    const result = await deleteGalleryPhoto(deleteId, brandSlug);
    if (result.ok) {
      setGalleryList((list) => list.filter((p) => p.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="premium-panel rounded-2xl p-4" data-testid="brand-kit-panel">
        <p className="eyebrow mb-2">{t("title")}</p>
        <form action={submitKit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("taglineLabel")}</span>
            <input
              name="tagline"
              maxLength={120}
              defaultValue={kit.tagline ?? ""}
              placeholder={t("taglinePlaceholder")}
              data-testid="brand-kit-tagline"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("foundedLabel")}</span>
            <input
              type="date"
              name="foundedOn"
              defaultValue={kit.foundedOn ?? ""}
              max={TODAY}
              data-testid="brand-kit-founded"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("yearsLabel")}</span>
            <input
              type="number"
              name="yearsExperience"
              min={0}
              max={100}
              defaultValue={kit.yearsExperience ?? ""}
              data-testid="brand-kit-years"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("philosophyLabel")}</span>
            <textarea
              name="philosophy"
              rows={3}
              maxLength={1000}
              defaultValue={kit.philosophy ?? ""}
              placeholder={t("philosophyPlaceholder")}
              data-testid="brand-kit-philosophy"
              className="rounded-xl border border-input bg-transparent p-2 text-sm"
            />
          </label>
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{t("specialtiesLabel")}</span>
            {specialties.length > 0 && (
              <ul className="mb-1 flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <li
                    key={s}
                    className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs"
                    data-testid="specialty-chip"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => setSpecialties(specialties.filter((v) => v !== s))}
                      aria-label={t("specialtiesRemove", { value: s })}
                      data-testid="specialty-remove"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              onBlur={addSpecialty}
              placeholder={t("specialtiesHint")}
              data-testid="brand-kit-specialty-input"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-xs text-secondary-foreground" role="status">
              {t("saved")}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            data-testid="brand-kit-save"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </form>
      </section>

      <section className="premium-panel rounded-2xl p-4" data-testid="brand-gallery-manager">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">{t("galleryTitle")}</p>
          <span className="text-xs text-muted-foreground" data-testid="brand-gallery-count">
            {t("galleryCount", { count: galleryList.length })}
          </span>
        </div>

        {galleryList.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galleryList.map((photo) => (
              <li key={photo.id} className="flex flex-col gap-2" data-testid="gallery-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.photoUrl} alt="" className="aspect-square w-full rounded-xl object-cover" />
                <input
                  defaultValue={photo.caption ?? ""}
                  placeholder={t("galleryCaptionPlaceholder")}
                  onChange={(e) => setCaptionDrafts((d) => ({ ...d, [photo.id]: e.target.value }))}
                  onBlur={() => saveCaption(photo.id)}
                  aria-label={t("galleryCaptionLabel")}
                  data-testid="gallery-caption-input"
                  className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setDeleteId(photo.id)}
                  data-testid="gallery-delete-open"
                  className="min-h-11 rounded-lg border border-destructive/40 px-2 text-xs font-medium text-destructive"
                >
                  {t("galleryDelete")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground" data-testid="gallery-empty">
            {t("galleryEmpty")}
          </p>
        )}

        {galleryList.length < GALLERY_CAP ? (
          <label className="mt-3 block text-xs text-muted-foreground">
            {uploadBusy ? t("uploading") : t("galleryUploadCta")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => upload(e.target.files?.[0] ?? null)}
              disabled={uploadBusy}
              data-testid="gallery-upload-input"
              className="mt-1 block text-sm"
            />
          </label>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="gallery-full-notice">
            {t("galleryFull")}
          </p>
        )}
        {galleryError && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {galleryError}
          </p>
        )}

        {deleteId && (
          <div
            className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3"
            data-testid="gallery-delete-confirm-panel"
          >
            <p className="text-xs text-destructive">{t("galleryDeleteConfirmBody")}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={confirmDeletePhoto}
                data-testid="gallery-delete-confirm"
                className="min-h-11 rounded-lg bg-red-700 px-3 text-xs font-medium text-white"
              >
                {t("confirmDelete")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="min-h-11 rounded-lg border border-input px-3 text-xs font-medium"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
