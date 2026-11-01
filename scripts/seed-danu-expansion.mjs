import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const PROD_REF = "qygdixvmxrezhavvnkgc";
const PROD_OWNER_ID = "7ce63264-282e-49c8-95f9-0a5e760950da";
const PROD_BRAND_ID = "20f32b0b-dfc8-4959-b644-6086cde18c8e";
const OLIVER_ID = "d2c24c95-3d1c-47b2-8b8f-9ac61da1700b";
const LITTER_ID = "e1000000-0000-4000-8000-000000000001";
const OLIVER_STUD_SERVICE_ID = "e3000000-0000-4000-8000-000000000001";
const LITTER_LISTING_ID = "e2000000-0000-4000-8000-000000000001";

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

async function run() {
  console.log("=== Seeding Danu's Ark Expansion: Oliver & 2026 Litter Listing ===");

  // 1. Update Oliver's pedigree & health notes
  console.log("1. Updating Oliver's health notes and registration...");
  const updateOliver = await query(`
    UPDATE public.creatures
    SET
      registration_number = 'AKC WS75492101',
      health_notes = 'OFA Hips: Good (Preliminary), OFA Cardiac: Normal. DNA Health Panel: Clear for CMR1, DM, and DSRA. High-drive guardian temperament with balanced on/off switch for working and family companionship.',
      page_visible = true,
      in_roster = true
    WHERE id = '${OLIVER_ID}';
  `);
  console.log("✓ Oliver updated:", updateOliver);

  // 2. Insert or update Oliver's stud service
  console.log("2. Upserting Oliver's stud service in public.services...");
  const oliverService = await query(`
    INSERT INTO public.services (
      id, owner_id, brand_id, name, description, category,
      price_cents, currency, area, active, media_url,
      deposit_required, deposit_amount_cents, booking_enabled, created_at, updated_at
    ) VALUES (
      '${OLIVER_STUD_SERVICE_ID}',
      '${PROD_OWNER_ID}',
      '${PROD_BRAND_ID}',
      'Oliver — Italian Cane Corso Stud Service & Fresh Chilled Semen',
      'Proven Italian Cane Corso sire offering stud services to approved health-tested females. Heavy bone density, athletic structure, and confident guardian drive. Natural breeding available locally in Toledo, OH; overnight chilled semen shipping available nationwide with certified veterinary reproduction handling.',
      'other',
      200000,
      'usd',
      'Toledo, OH & Nationwide (Chilled Semen)',
      true,
      'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/81f78c35-195a-4d27-9ed0-eab8a1e04b02.jpeg',
      true,
      50000,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price_cents = EXCLUDED.price_cents,
      media_url = EXCLUDED.media_url,
      deposit_required = EXCLUDED.deposit_required,
      deposit_amount_cents = EXCLUDED.deposit_amount_cents,
      active = true,
      updated_at = NOW();
  `);
  console.log("✓ Oliver stud service upserted:", oliverService);

  // 3. Upsert litter reservation listing in public.listings
  console.log("3. Upserting 2026 Presa Canario waitlist reservation listing...");
  const litterListing = await query(`
    INSERT INTO public.listings (
      id, seller_id, brand_id, title, description, price_cents,
      currency, category, availability, listing_kind, sale_mode,
      deposit_bps, inspection_hours, media_url, posting_as_type,
      about_type, about_id, created_at, updated_at
    ) VALUES (
      '${LITTER_LISTING_ID}',
      '${PROD_OWNER_ID}',
      '${PROD_BRAND_ID}',
      'Danu''s Ark 2026 Working Presa Canario Litter (Big Meech × Hera) — Waitlist Reservation',
      'Planned working Molosser breeding between Big Meech (UKC D191-225) and W Hera De La Arena. Heavy bone density, stable family guardian temperament, OFA health tested parents. Waitlist reservations guarantee placement order. Nationwide licensed pet transport available upon 8-week weaning.',
      250000,
      'usd',
      'dog',
      'available',
      'sale',
      'contract_escrow',
      2000,
      72,
      'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/1f3b3a35-bd02-43af-9b1e-f6780b500a92.jpeg',
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
  console.log("✓ Litter waitlist listing upserted:", litterListing);

  console.log("\n=== Danu's Ark Expansion Seeding Complete! ===");
}

run().catch(console.error);
