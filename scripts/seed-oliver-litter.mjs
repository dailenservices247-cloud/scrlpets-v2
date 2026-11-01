import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const PROD_REF = "qygdixvmxrezhavvnkgc";
const PROD_OWNER_ID = "7ce63264-282e-49c8-95f9-0a5e760950da";
const PROD_BRAND_ID = "20f32b0b-dfc8-4959-b644-6086cde18c8e";
const OLIVER_ID = "d2c24c95-3d1c-47b2-8b8f-9ac61da1700b";
const DANU_ID = "a1000000-0000-4000-8000-000000000007";
const LITTER_ID = "e1000000-0000-4000-8000-000000000002";
const LISTING_ID = "e2000000-0000-4000-8000-000000000002";

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

async function run() {
  console.log("=== Seeding Oliver × Danu Cane Corso Pairing & Listing on PROD ===");

  // 1. Ensure Danu has female breeding role & visible
  console.log("1. Updating Danu creature profile...");
  await query(`
    UPDATE public.creatures
    SET
      creature_role = 'breeding',
      page_visible = true,
      in_roster = true,
      breed = 'Cane Corso',
      gender = 'female'
    WHERE id = '${DANU_ID}';
  `);
  console.log("✓ Danu profile updated");

  // 2. Insert or update Oliver × Danu litter
  console.log("2. Upserting planned Cane Corso litter...");
  const litterRes = await query(`
    INSERT INTO public.litters (
      id, owner_id, brand_id, name, species, breed, description,
      expected_date, status, sire_id, dam_id, cover_url, created_at, updated_at
    ) VALUES (
      '${LITTER_ID}',
      '${PROD_OWNER_ID}',
      '${PROD_BRAND_ID}',
      'Danu''s Ark 2026 Italian Cane Corso Companion & Guardian Litter',
      'dog',
      'Cane Corso',
      'Planned authentic Italian Cane Corso pairing: Oliver (AKC WS75492101, OFA Hips/Cardiac cleared) × Foundation Dam Danu. Bred for athletic conformation, stable family guardian temperament, high intelligence, and strong bone density. Complete 3-generation verified pedigree, health guarantee, and early waitlist reservations open.',
      '2027-01-20',
      'expecting',
      '${OLIVER_ID}',
      '${DANU_ID}',
      'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/81f78c35-195a-4d27-9ed0-eab8a1e04b02.jpeg',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      expected_date = EXCLUDED.expected_date,
      cover_url = EXCLUDED.cover_url,
      updated_at = NOW();
  `);
  console.log("✓ Litter upserted:", litterRes);

  // 3. Upsert waitlist reservation listing
  console.log("3. Upserting Cane Corso waitlist listing...");
  const listingRes = await query(`
    INSERT INTO public.listings (
      id, seller_id, brand_id, title, description, price_cents,
      currency, category, availability, listing_kind, sale_mode,
      deposit_bps, inspection_hours, media_url, posting_as_type,
      about_type, about_id, created_at, updated_at
    ) VALUES (
      '${LISTING_ID}',
      '${PROD_OWNER_ID}',
      '${PROD_BRAND_ID}',
      'Danu''s Ark 2026 Cane Corso Litter (Oliver × Danu) — Priority Waitlist Reservation',
      'Planned working Molosser breeding between Oliver (AKC WS75492101) and foundation dam Danu. Heavy bone structure, confident guardian drive, and loving home disposition. Reservations lock in selection order upon 8-week weaning. Licensed nationwide ground and flight nanny pet transport available.',
      220000,
      'usd',
      'dog',
      'available',
      'sale',
      'contract_escrow',
      2000,
      72,
      'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/81f78c35-195a-4d27-9ed0-eab8a1e04b02.jpeg',
      'brand',
      'litter',
      '${LITTER_ID}',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      price_cents = EXCLUDED.price_cents,
      deposit_bps = EXCLUDED.deposit_bps,
      availability = EXCLUDED.availability,
      media_url = EXCLUDED.media_url,
      updated_at = NOW();
  `);
  console.log("✓ Listing upserted:", listingRes);

  console.log("\n=== Cane Corso Pairing & Listing Seeding Complete! ===");
}

run().catch(console.error);
