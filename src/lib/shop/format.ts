// Pure formatting helper. Kept out of queries.ts so client components can
// import it without dragging in the server-only Supabase client.
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
