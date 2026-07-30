import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, SELLER_EMAIL, THIRD_EMAIL, signInCached } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(email: string) {
  return signInCached(email);
}

/**
 * PHASE A ACCEPTANCE — the things legacy structurally could not do.
 * Legacy's pack Accept wrote constraint-illegal statuses (never worked once)
 * and its notification trigger listened for an event no code path produced
 * (never fired once). These tests exist so neither defect can return.
 */
test("pack invite lifecycle: notify on invite, notify on accept, block severs", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const member = await signIn(MEMBER_EMAIL);

  // Clean slate for this worker's pair (either direction).
  await seller.db.from("pack_links").delete().or(
    `requester_id.eq.${seller.userId},addressee_id.eq.${seller.userId}`,
  );

  // Invite: seller → member.
  const invite = await seller.db
    .from("pack_links")
    .insert({ requester_id: seller.userId, addressee_id: member.userId })
    .select("id,status")
    .single();
  expect(invite.error).toBeNull();
  expect(invite.data!.status).toBe("pending");

  // THE notification legacy never fired.
  const inviteNote = await member.db
    .from("notifications")
    .select("id")
    .eq("kind", "pack_invite")
    .eq("target_id", invite.data!.id);
  expect(inviteNote.data!.length).toBe(1);

  // Duplicate invite (either direction) is refused by the pair index.
  const dupe = await member.db
    .from("pack_links")
    .insert({ requester_id: member.userId, addressee_id: seller.userId });
  expect(dupe.error, "one link per pair").not.toBeNull();

  // Requester cannot accept their own invite.
  const selfAccept = await seller.db
    .from("pack_links")
    .update({ status: "accepted" }, { count: "exact" })
    .eq("id", invite.data!.id);
  expect(selfAccept.count ?? 0).toBe(0);

  // Addressee accepts; accepted_at stamps; requester is notified.
  const accept = await member.db
    .from("pack_links")
    .update({ status: "accepted" })
    .eq("id", invite.data!.id)
    .select("status,accepted_at")
    .single();
  expect(accept.error).toBeNull();
  expect(accept.data!.status).toBe("accepted");
  expect(accept.data!.accepted_at).not.toBeNull();

  const acceptNote = await seller.db
    .from("notifications")
    .select("id")
    .eq("kind", "pack_accepted")
    .eq("target_id", invite.data!.id);
  expect(acceptNote.data!.length).toBe(1);

  // A block severs the link both directions (blocks write through the RPC).
  const block = await seller.db.rpc("block_user", { target_id: member.userId });
  expect(block.error).toBeNull();
  const afterBlock = await seller.db
    .from("pack_links")
    .select("id")
    .eq("id", invite.data!.id);
  expect(afterBlock.data!.length, "block severed the pack link").toBe(0);

  // And a new invite to a blocked party is refused at the policy.
  const reInvite = await seller.db
    .from("pack_links")
    .insert({ requester_id: seller.userId, addressee_id: member.userId });
  expect(reInvite.error, "cannot invite across a block").not.toBeNull();

  // Cleanup — asserted (a silent no-op polluted a public surface once).
  const unblock = await seller.db.rpc("unblock_user", { target_id: member.userId });
  expect(unblock.error).toBeNull();
  await seller.db
    .from("notifications")
    .delete()
    .eq("kind", "pack_invite")
    .eq("target_id", invite.data!.id);
});

test("confirmed handover auto-creates alumni + accepted pack link, exactly once", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const buyer = await signIn(MEMBER_EMAIL);
  const stamp = Date.now();

  // Pre-clean the pair.
  await seller.db.from("pack_links").delete().or(
    `requester_id.eq.${seller.userId},addressee_id.eq.${seller.userId}`,
  );

  // Seller (verified fixture) lists an animal legitimately.
  const creature = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E spine animal ${stamp}`,
      slug: `e2e-spine-${stamp}`,
      species: "Dog",
      birth_date: "2025-01-01",
      weaned_date: "2025-03-01",
    })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  await seller.db.rpc("attest_animal_eligibility", {
    target_creature: creature.data!.id,
  });

  const listing = await seller.db
    .from("listings")
    .insert({
      seller_id: seller.userId,
      title: `E2E spine listing ${stamp}`,
      price_cents: 10000,
      creature_id: creature.data!.id,
    })
    .select("id")
    .single();
  expect(listing.error).toBeNull();

  const application = await buyer.db
    .from("buyer_applications")
    .insert({
      buyer_id: buyer.userId,
      seller_id: seller.userId,
      listing_id: listing.data!.id,
    })
    .select("id")
    .single();
  expect(application.error).toBeNull();
  const applicationId = application.data!.id;

  // Accept via the definer, then both parties confirm the handover.
  const accept = await seller.db.rpc("set_application_status", {
    target_application: applicationId,
    new_status: "accepted",
  });
  expect(accept.error).toBeNull();
  expect((await buyer.db.rpc("confirm_handover", { target_application: applicationId })).error).toBeNull();
  expect((await seller.db.rpc("confirm_handover", { target_application: applicationId })).error).toBeNull();

  // Alumni exists, both parties see it, identity is the application.
  const alumni = await buyer.db
    .from("alumni")
    .select("id,breeder_id,owner_id,creature_id")
    .eq("application_id", applicationId);
  expect(alumni.data!.length).toBe(1);
  expect(alumni.data![0].breeder_id).toBe(seller.userId);
  expect(alumni.data![0].owner_id).toBe(buyer.userId);
  expect(alumni.data![0].creature_id).toBe(creature.data!.id);

  // Pack link exists, accepted, handover-origin.
  const link = await seller.db
    .from("pack_links")
    .select("id,status,origin")
    .or(`requester_id.eq.${seller.userId},addressee_id.eq.${seller.userId}`);
  expect(link.data!.length).toBe(1);
  expect(link.data![0].status).toBe("accepted");
  expect(link.data![0].origin).toBe("handover");

  // Alumni is client-unwritable: a third party cannot insert one.
  const outsider = await signIn(THIRD_EMAIL);
  const forge = await outsider.db.from("alumni").insert({
    breeder_id: outsider.userId,
    owner_id: buyer.userId,
    application_id: applicationId,
    handover_at: new Date().toISOString(),
  });
  expect(forge.error, "alumni has no client write path").not.toBeNull();

  // INVARIANT, not cleanup failure: a confirmed application is transaction
  // evidence — NEITHER party can destroy it (and the alumni row rides its
  // lifecycle). The zero-row delete is the security property.
  const delApp = await seller.db
    .from("buyer_applications")
    .delete({ count: "exact" })
    .eq("id", applicationId);
  expect(delApp.count, "confirmed applications are permanent evidence").toBe(0);

  // Cleanup that IS possible — asserted: sever the pack pair, soft-delete the
  // listing, hide the creature (no owner hard-delete exists; see build-queue
  // note for the roster-management question).
  const delLinks = await seller.db
    .from("pack_links")
    .delete({ count: "exact" })
    .or(`requester_id.eq.${seller.userId},addressee_id.eq.${seller.userId}`);
  expect(delLinks.count).toBe(1);
  const softDel = await seller.db.rpc("soft_delete_managed_listing", {
    target_listing_id: listing.data!.id,
  });
  expect(softDel.error).toBeNull();
  // INVARIANT: the animal itself moved. A confirmed handover transfers
  // creatures.owner_id to the buyer, so the SELLER can no longer touch it —
  // that refusal is the property, and it is why the hide below runs as the
  // buyer. Before this, alumni named the buyer as owner while the creature row
  // still named the seller, and every owner-only path obeyed the stale one.
  const ownerRow = await buyer.db
    .from("creatures")
    .select("owner_id")
    .eq("id", creature.data!.id)
    .single();
  expect(ownerRow.data!.owner_id, "handover transfers the animal").toBe(buyer.userId);

  const staleOwnerHide = await seller.db
    .from("creatures")
    .update({ page_visible: false }, { count: "exact" })
    .eq("id", creature.data!.id);
  expect(staleOwnerHide.count, "the previous owner loses control of the animal").toBe(0);

  const hide = await buyer.db
    .from("creatures")
    .update({ page_visible: false }, { count: "exact" })
    .eq("id", creature.data!.id);
  expect(hide.count).toBe(1);
});

test("commerce guards: adoption cap + eight-week rule refuse at the database", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const stamp = Date.now();

  const creature = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E guard animal ${stamp}`,
      slug: `e2e-guard-${stamp}`,
      species: "Dog",
      birth_date: "2025-01-01",
      weaned_date: "2025-03-01",
    })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id;
  await seller.db.rpc("attest_animal_eligibility", { target_creature: creatureId });

  // Adoption above the cap refuses.
  const overCap = await seller.db.from("listings").insert({
    seller_id: seller.userId,
    title: `E2E overcap adoption ${stamp}`,
    price_cents: 60000,
    creature_id: creatureId,
    listing_kind: "adoption",
  });
  expect(overCap.error?.message ?? "").toContain("adoption_fee_above_cap");

  // A puppy under eight weeks refuses even for a verified seller.
  const pup = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E young pup ${stamp}`,
      slug: `e2e-pup-${stamp}`,
      species: "Dog",
      birth_date: new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10),
      weaned_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  expect(pup.error).toBeNull();
  await seller.db.rpc("attest_animal_eligibility", { target_creature: pup.data!.id });
  const tooYoung = await seller.db.from("listings").insert({
    seller_id: seller.userId,
    title: `E2E young listing ${stamp}`,
    price_cents: 10000,
    creature_id: pup.data!.id,
  });
  expect(tooYoung.error?.message ?? "").toContain("under_eight_weeks");

  // An animal with NO recorded dates lists fine — unknown age is unknown, not
  // a violation. 9 CFR 2.130 regulates transferring an underage animal, and
  // demanding dates as proof-of-innocence blocked every existing seller (the
  // full suite caught that over-reach; the guard now enforces on KNOWN dates).
  const dateless = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E dateless ${stamp}`,
      slug: `e2e-dateless-${stamp}`,
      species: "Dog",
    })
    .select("id")
    .single();
  await seller.db.rpc("attest_animal_eligibility", { target_creature: dateless.data!.id });
  const noDates = await seller.db.from("listings").insert({
    seller_id: seller.userId,
    title: `E2E dateless listing ${stamp}`,
    price_cents: 10000,
    creature_id: dateless.data!.id,
  });
  expect(noDates.error, "unknown age is not a violation").toBeNull();

  await seller.db.rpc("soft_delete_managed_listing", {
    target_listing_id: (
      await seller.db
        .from("listings")
        .select("id")
        .eq("title", `E2E dateless listing ${stamp}`)
        .single()
    ).data!.id,
  });

  // Cleanup — asserted. No owner hard-delete exists on creatures; hiding is
  // the available control and every guard above REFUSED, so nothing public
  // references these rows.
  for (const id of [creatureId, pup.data!.id, dateless.data!.id]) {
    const hide = await seller.db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("id", id);
    expect(hide.count).toBe(1);
  }
});
