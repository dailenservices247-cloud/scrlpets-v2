import { describe, it, expect } from "vitest";
import { parseCatalogCsv, SAMPLE_CATALOG_CSV } from "@/lib/brands/catalog-importer";

describe("Catalog CSV Ingestion Engine", () => {
  it("parses the sample catalog CSV with zero errors", () => {
    const res = parseCatalogCsv(SAMPLE_CATALOG_CSV, "Danu's Ark");
    expect(res.errors).toEqual([]);
    expect(res.validRows.length).toBe(5);

    const first = res.validRows[0];
    expect(first.title).toBe("Organic Salmon & Sweet Potato Kibble (30 lb)");
    expect(first.priceCents).toBe(6499);
    expect(first.category).toBe("Food");
    expect(first.sku).toBe("FOOD-SALM-30");
    expect(first.stockQuantity).toBe(45);
    expect(first.shippingFeeCents).toBe(0);
    expect(first.merchantName).toBe("Danu's Ark");
    expect(first.sellerSource).toBe("merchant");
  });

  it("handles messy quotes, internal commas, and formatted prices", () => {
    const csv = `Product Name,Price,Category,Stock,Shipping Fee
"Leather Collar, Brass Hardware","$34.50",Gear,10,"$5.00"
"Puppy Crate (36\\")",110.00,Crates,5,0`;

    const res = parseCatalogCsv(csv, "Test Brand");
    expect(res.errors).toEqual([]);
    expect(res.validRows.length).toBe(2);

    expect(res.validRows[0].title).toBe("Leather Collar, Brass Hardware");
    expect(res.validRows[0].priceCents).toBe(3450);
    expect(res.validRows[0].shippingFeeCents).toBe(500);
    expect(res.validRows[0].stockQuantity).toBe(10);

    expect(res.validRows[1].priceCents).toBe(11000);
    expect(res.validRows[1].stockQuantity).toBe(5);
  });

  it("reports detailed validation errors on invalid rows while accepting valid rows", () => {
    const csv = `Title,Price,Stock
"Valid Product 1",25.00,10
"",30.00,5
"Negative Price",-10.00,2
"Bad Stock",15.00,-3
"Valid Product 2",40.00,`;

    const res = parseCatalogCsv(csv);
    expect(res.validRows.length).toBe(2);
    expect(res.errors.length).toBe(3);

    expect(res.errors[0].field).toBe("title");
    expect(res.errors[1].field).toBe("price");
    expect(res.errors[2].field).toBe("stock");

    expect(res.validRows[0].title).toBe("Valid Product 1");
    expect(res.validRows[1].title).toBe("Valid Product 2");
    expect(res.validRows[1].stockQuantity).toBeNull(); // Empty stock means made-to-order / unlimited
  });

  it("rejects CSV without required Title and Price headers", () => {
    const csv = `Description,Color,Size
"Some bed",Blue,Large`;

    const res = parseCatalogCsv(csv);
    expect(res.validRows.length).toBe(0);
    expect(res.errors[0].field).toBe("headers");
  });
});
