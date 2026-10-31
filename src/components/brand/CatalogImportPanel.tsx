"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, PackagePlus, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { parseCatalogCsv, SAMPLE_CATALOG_CSV, type ParsedCatalogRow, type RowValidationError } from "@/lib/brands/catalog-importer";
import { bulkImportCatalog } from "@/lib/brands/catalog-actions";
import { formatPrice } from "@/lib/shop/format";

export function CatalogImportPanel({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCatalogRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<RowValidationError[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? "");
      setCsvText(content);
      processCsv(content);
    };
    reader.readAsText(file);
  }

  function processCsv(content: string) {
    setApiError(null);
    setSuccessCount(null);
    const { validRows, errors } = parseCatalogCsv(content, brandName);
    setParsedRows(validRows);
    setValidationErrors(errors);
    setShowPreview(validRows.length > 0 || errors.length > 0);
  }

  function handleDownloadTemplate() {
    const blob = new Blob([SAMPLE_CATALOG_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "scrlpets-catalog-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (parsedRows.length === 0 || !csvText) return;
    setApiError(null);

    startTransition(async () => {
      const result = await bulkImportCatalog(brandId, csvText);
      if (result.ok) {
        setSuccessCount(result.importedCount);
        setParsedRows([]);
        setCsvText("");
      } else {
        setApiError(result.error || "Failed to import catalog items.");
      }
    });
  }

  return (
    <div className="premium-panel rounded-2xl p-4 sm:p-5" data-testid="catalog-import-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-brand-link">
            <PackagePlus className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Bulk Catalog &amp; Inventory Importer</h2>
            <p className="text-xs text-muted-foreground">
              Plug your company&apos;s product inventory directly into Scrlpets via CSV.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCsvText(SAMPLE_CATALOG_CSV);
              processCsv(SAMPLE_CATALOG_CSV);
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-link transition hover:bg-primary/20"
            data-testid="load-sample-btn"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Load Sample Starter Inventory
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            data-testid="download-template-btn"
          >
            <Download className="size-3.5" aria-hidden />
            Download Sample CSV
          </button>
        </div>
      </div>

      {successCount !== null && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Successfully imported <strong>{successCount}</strong> product{successCount === 1 ? "" : "s"} into <strong>{brandName}</strong>. They are now live on the marketplace.
          </span>
        </div>
      )}

      {apiError && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card/40 p-4 text-center transition hover:border-primary/60 hover:bg-card/70">
          <FileSpreadsheet className="size-6 text-muted-foreground" aria-hidden />
          <span className="mt-2 text-xs font-medium text-foreground">
            Click to upload your product CSV spreadsheet
          </span>
          <span className="text-micro text-muted-foreground">
            Supports Title, Price, Category, SKU, Stock, ShippingFee, Description, and MediaUrl
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            data-testid="catalog-csv-input"
          />
        </label>
      </div>

      {showPreview && (
        <div className="mt-4 rounded-xl border border-border/80 bg-background/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">
                Parsed: <strong>{parsedRows.length}</strong> valid items
              </span>
              {validationErrors.length > 0 && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-micro font-medium text-destructive">
                  {validationErrors.length} row error{validationErrors.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showPreview ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>

          {validationErrors.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-micro text-destructive">
              {validationErrors.map((err, idx) => (
                <p key={idx}>
                  Line {err.rowNumber} [{err.field}]: {err.message}
                </p>
              ))}
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="pb-1.5 font-medium">Title</th>
                    <th className="pb-1.5 font-medium">Price</th>
                    <th className="pb-1.5 font-medium">Category</th>
                    <th className="pb-1.5 font-medium">SKU</th>
                    <th className="pb-1.5 font-medium">Stock</th>
                    <th className="pb-1.5 font-medium">Shipping</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {parsedRows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="text-foreground/90">
                      <td className="py-1.5 max-w-44 truncate pr-2 font-medium">{r.title}</td>
                      <td className="py-1.5 pr-2 font-mono text-brand-link">{formatPrice(r.priceCents, "usd")}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{r.category}</td>
                      <td className="py-1.5 pr-2 font-mono text-micro text-muted-foreground">{r.sku || "—"}</td>
                      <td className="py-1.5 pr-2">
                        {r.stockQuantity !== null ? (
                          <span className="font-medium text-emerald-400">{r.stockQuantity} in stock</span>
                        ) : (
                          <span className="text-muted-foreground">Made to order</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {r.shippingFeeCents > 0 ? formatPrice(r.shippingFeeCents, "usd") : "Free"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <p className="mt-1 text-center text-micro text-muted-foreground">
                  ...and {parsedRows.length - 10} more items
                </p>
              )}
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleImport}
                disabled={isPending}
                className="min-h-10 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                data-testid="execute-import-btn"
              >
                {isPending ? "Ingesting Catalog..." : `Publish ${parsedRows.length} Items to ${brandName}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
