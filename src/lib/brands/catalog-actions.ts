"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBrandRole } from "./queries";
import { canManageBrandContent } from "./types";
import { parseCatalogCsv, type ParsedCatalogRow, type RowValidationError } from "./catalog-importer";

export type BulkImportResult = {
  ok: boolean;
  importedCount: number;
  errors: RowValidationError[];
  error?: string;
};

export async function bulkImportCatalog(
  brandId: string,
  csvContent: string,
): Promise<BulkImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, importedCount: 0, errors: [], error: "Authentication required" };
  }

  // Permission check: user must be an owner or admin of the brand
  const role = await getBrandRole(user.id, brandId);
  if (!role || !canManageBrandContent(role)) {
    return { ok: false, importedCount: 0, errors: [], error: "You must be a manager of this brand to import catalog products." };
  }

  // Lookup brand metadata
  const { data: brand } = await supabase
    .from("brands")
    .select("name, slug")
    .eq("id", brandId)
    .single();

  const brandName = brand?.name ?? "Brand";
  const { validRows, errors } = parseCatalogCsv(csvContent, brandName);

  if (validRows.length === 0) {
    return {
      ok: false,
      importedCount: 0,
      errors,
      error: errors[0]?.message || "No valid rows found in CSV.",
    };
  }

  // Format rows for insertion into listings
  const rowsToInsert = validRows.map((r: ParsedCatalogRow) => ({
    seller_id: user.id,
    brand_id: brandId,
    posting_as_type: "brand",
    about_type: "none",
    title: r.title,
    price_cents: r.priceCents,
    category: r.category,
    listing_kind: "sale",
    creature_id: null,
    seller_source: r.sellerSource,
    merchant_name: r.merchantName,
    external_sku: r.sku,
    external_url: r.externalUrl,
    media_url: r.mediaUrl,
    description: r.description,
    sale_mode: r.saleMode,
    stock_quantity: r.stockQuantity,
    shipping_fee_cents: r.shippingFeeCents,
    deposit_bps: 0,
    inspection_hours: 48,
    availability: "available",
    currency: "usd",
  }));

  // Batch insert in chunks of 50
  const CHUNK_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase.from("listings").insert(chunk);

    if (insertError) {
      return {
        ok: inserted > 0,
        importedCount: inserted,
        errors: [...errors, { rowNumber: i + 1, field: "database", message: insertError.message }],
        error: `Database error during bulk insert: ${insertError.message}`,
      };
    }
    inserted += chunk.length;
  }

  revalidatePath("/brand-os");
  revalidatePath("/market");
  if (brand?.slug) {
    revalidatePath(`/b/${brand.slug}`);
  }

  return {
    ok: true,
    importedCount: inserted,
    errors,
  };
}
