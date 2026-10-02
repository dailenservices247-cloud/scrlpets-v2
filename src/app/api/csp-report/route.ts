/** Stub for the RED commit — accepts and discards, so the tests fail on assertions. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  return new Response(null, { status: 204 });
}
