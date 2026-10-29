import { parsePriceCents } from "@/lib/compose/validation";

export type ParsedCatalogRow = {
  rowNumber: number;
  title: string;
  priceCents: number;
  category: string;
  sku: string | null;
  stockQuantity: number | null;
  shippingFeeCents: number;
  description: string | null;
  mediaUrl: string | null;
  externalUrl: string | null;
  merchantName: string | null;
  sellerSource: "merchant" | "distributor";
  saleMode: "direct_checkout" | "contract_escrow";
};

export type RowValidationError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type CatalogParseResult = {
  validRows: ParsedCatalogRow[];
  errors: RowValidationError[];
  totalRows: number;
};

/**
 * Robust CSV Line Parser that respects quotes, commas, and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "\\" && line[i + 1] === '"') {
      current += '"';
      i++; // skip escaped quote
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanPriceInput(raw: string): string {
  return raw.replace(/[\$,\s]/g, "");
}

/**
 * Normalizes header keys to canonical fields.
 */
function normalizeHeader(h: string): string {
  const cleaned = h.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleaned.includes("title") || cleaned.includes("name") || cleaned.includes("product")) return "title";
  if (cleaned.includes("price") || cleaned.includes("amount") || cleaned.includes("cost")) return "price";
  if (cleaned.includes("cat") || cleaned.includes("type")) return "category";
  if (cleaned.includes("sku") || cleaned.includes("barcode") || cleaned.includes("upc")) return "sku";
  if (cleaned.includes("stock") || cleaned.includes("qty") || cleaned.includes("quantity") || cleaned.includes("inventory")) return "stock";
  if (cleaned.includes("ship") || cleaned.includes("shippingfee") || cleaned.includes("freight")) return "shipping_fee";
  if (cleaned.includes("desc") || cleaned.includes("detail")) return "description";
  if (cleaned.includes("image") || cleaned.includes("media") || cleaned.includes("photo") || cleaned.includes("picture")) return "media_url";
  if (cleaned.includes("url") || cleaned.includes("link") || cleaned.includes("website")) return "external_url";
  if (cleaned.includes("merchant") || cleaned.includes("brand") || cleaned.includes("vendor") || cleaned.includes("store")) return "merchant_name";
  return cleaned;
}

export function parseCatalogCsv(csvContent: string, defaultBrandName?: string): CatalogParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, field: "file", message: "CSV file must include a header line and at least one data row" }],
      totalRows: 0,
    };
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerMap.set(normalizeHeader(h), idx);
  });

  const titleIdx = headerMap.get("title");
  const priceIdx = headerMap.get("price");

  if (titleIdx === undefined || priceIdx === undefined) {
    return {
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          field: "headers",
          message: "CSV must contain at least 'Title' (or 'Name') and 'Price' columns.",
        },
      ],
      totalRows: 0,
    };
  }

  const validRows: ParsedCatalogRow[] = [];
  const errors: RowValidationError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => v === "")) continue; // Skip blank lines

    const get = (key: string): string => {
      const idx = headerMap.get(key);
      return idx !== undefined && values[idx] ? values[idx].trim() : "";
    };

    const rawTitle = get("title");
    const rawPrice = get("price");
    const rawCategory = get("category") || "supplies";
    const rawSku = get("sku") || null;
    const rawStock = get("stock");
    const rawShipping = get("shipping_fee");
    const rawDesc = get("description") || null;
    const rawMedia = get("media_url") || null;
    const rawExternal = get("external_url") || null;
    const rawMerchant = get("merchant_name") || defaultBrandName || null;

    // Validation
    if (!rawTitle || rawTitle.length < 1 || rawTitle.length > 120) {
      errors.push({ rowNumber, field: "title", message: "Product title must be between 1 and 120 characters." });
      continue;
    }

    const priceCents = parsePriceCents(cleanPriceInput(rawPrice));
    if (priceCents === null || priceCents <= 0) {
      errors.push({ rowNumber, field: "price", message: `Invalid price "${rawPrice}". Must be a valid positive amount.` });
      continue;
    }

    let stockQuantity: number | null = null;
    if (rawStock) {
      const parsedStock = parseInt(rawStock, 10);
      if (isNaN(parsedStock) || parsedStock < 0) {
        errors.push({ rowNumber, field: "stock", message: `Invalid stock count "${rawStock}". Must be a non-negative number.` });
        continue;
      }
      stockQuantity = parsedStock;
    }

    let shippingFeeCents = 0;
    if (rawShipping) {
      const parsedShipping = parsePriceCents(cleanPriceInput(rawShipping));
      if (parsedShipping !== null && parsedShipping >= 0) {
        shippingFeeCents = parsedShipping;
      }
    }

    validRows.push({
      rowNumber,
      title: rawTitle,
      priceCents,
      category: rawCategory,
      sku: rawSku,
      stockQuantity,
      shippingFeeCents,
      description: rawDesc ? rawDesc.slice(0, 2000) : null,
      mediaUrl: rawMedia,
      externalUrl: rawExternal,
      merchantName: rawMerchant,
      sellerSource: "merchant",
      saleMode: "direct_checkout",
    });
  }

  return {
    validRows,
    errors,
    totalRows: lines.length - 1,
  };
}

export const SAMPLE_CATALOG_CSV = `Title,Price,Category,SKU,Stock,ShippingFee,Description,MediaUrl,ExternalUrl
"Organic Salmon & Sweet Potato Kibble (30 lb)",64.99,"Food","FOOD-SALM-30",45,0.00,"Grain-free premium formula with probiotics and omega fatty acids for coat health.","https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600",""
"Heavy-Duty Escape-Proof Dog Crate (42 in)",189.00,"Crates","CRATE-HD-42",12,15.00,"Double-door high-tensile steel crate with anti-collapse safety latches.","https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600",""
"Orthopedic Memory Foam Pet Bed (Large)",79.50,"Beds","BED-ORTHO-LG",20,0.00,"Waterproof liner, removable washable plush microsuede cover.","https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=600",""
"Biothane Waterproof Working Lead (6 ft)",28.00,"Gear","LEAD-BIO-6FT",60,4.99,"All-weather stink-proof tactical biothane with brass hardware.","https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600",""
"Stainless Steel Anti-Gulp Slow Feeder Bowl",18.99,"Bowls","BOWL-SLOW-SS",85,0.00,"Prevents bloat and improves digestion with non-slip rubber base.","https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=600",""`;
