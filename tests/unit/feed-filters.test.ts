import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The feed stops naming every followed and blocked profile in a URL.
 *
 * These assert the SHAPE of the call, not just its result. The defect was never
 * a wrong answer — it was a correct answer that stops fitting in a request line
 * somewhere past 400 follows, which no test returning rows would ever notice.
 *
 * Kept out of feed-query.test.ts so a module mock of the Supabase client does
 * not leak into that file's pure-function tests.
 */
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

const VIEWER = "11111111-1111-1111-1111-111111111111";

/** `.from("follows").select(..., {count, head}).eq(...)` resolving to a count. */
function followCount(count: number) {
  return { select: () => ({ eq: () => Promise.resolve({ count, error: null }) }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  rpc.mockResolvedValue({ data: [], error: null });
  from.mockReturnValue(followCount(0));
});

describe("getFeed", () => {
  it("asks the database to do the filtering, and passes no id list", async () => {
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("for_you", VIEWER);
    expect(rpc).toHaveBeenCalledWith("feed_rows", expect.any(Object));
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    // The whole point: nothing array-shaped crosses the wire.
    for (const value of Object.values(args)) {
      expect(Array.isArray(value)).toBe(false);
    }
  });

  it("does not turn on the follow filter below the bootstrap threshold", async () => {
    // Under 3 follows the Following tab shows everything, so a first-run feed
    // is never a near-empty page.
    from.mockReturnValue(followCount(2));
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("following", VIEWER);
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: false });
  });

  it("turns it on at the threshold", async () => {
    from.mockReturnValue(followCount(3));
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("following", VIEWER);
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: true });
  });

  it("stays off for a guest, who has no graph to filter by", async () => {
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("following", null);
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: false });
  });

  it("never turns it on for the for-you tab, however many follows", async () => {
    from.mockReturnValue(followCount(900));
    const { getFeed } = await import("@/lib/feed/query");
    await getFeed("for_you", VIEWER);
    expect(rpc.mock.calls[0][1]).toMatchObject({ following_only: false });
  });
});

describe("followingFeedBroadened", () => {
  it("counts follows without fetching a single id", async () => {
    // It used to call getFollowingIds and read .length — fetching up to
    // thousands of UUIDs to compare a number against 3.
    from.mockReturnValue(followCount(2));
    const { followingFeedBroadened } = await import("@/lib/feed/query");
    expect(await followingFeedBroadened(VIEWER)).toBe(true);
    expect(from).toHaveBeenCalledWith("follows");
  });

  it("is false once the graph is big enough to carry a feed", async () => {
    from.mockReturnValue(followCount(3));
    const { followingFeedBroadened } = await import("@/lib/feed/query");
    expect(await followingFeedBroadened(VIEWER)).toBe(false);
  });

  it("is always true for a guest", async () => {
    const { followingFeedBroadened } = await import("@/lib/feed/query");
    expect(await followingFeedBroadened(null)).toBe(true);
  });
});
