import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const PROD_REF = "qygdixvmxrezhavvnkgc";
const PROD_OWNER_ID = "7ce63264-282e-49c8-95f9-0a5e760950da";
const PROD_BRAND_ID = "20f32b0b-dfc8-4959-b644-6086cde18c8e";
const BIG_MEECH_ID = "72f5c2da-c822-4b7a-a9f4-923d853bdc2b";
const HERA_ID = "a1000000-0000-4000-8000-000000000002";

async function query(projRef, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  return res.json();
}

async function run() {
  console.log("=== Seeding Verified Working Molosser Litter on PROD ===");

  const existing = await query(PROD_REF, `
    SELECT id FROM public.litters WHERE brand_id = '${PROD_BRAND_ID}' LIMIT 1;
  `);

  if (!Array.isArray(existing) || existing.length === 0) {
    const litterId = "e1000000-0000-4000-8000-000000000001";
    await query(PROD_REF, `
      INSERT INTO public.litters (
        id, owner_id, brand_id, name, species, breed, description,
        expected_date, status, sire_id, dam_id, cover_url, created_at, updated_at
      ) VALUES (
        '${litterId}',
        '${PROD_OWNER_ID}',
        '${PROD_BRAND_ID}',
        'Danu''s Ark 2026 Working Presa Canario Litter',
        'dog',
        'Perro de Presa Canario',
        'Planned working Molosser breeding: Big Meech (UKC D191-225) × W Hera De La Arena. Heavy bone density, stable guardian temperament, and active family companionship. Triple-generation pedigree verification on the pack tree. Early waitlist reservations open for working homes and companion placements.',
        '2026-12-15',
        'expecting',
        '${BIG_MEECH_ID}',
        '${HERA_ID}',
        'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/1f3b3a35-bd02-43af-9b1e-f6780b500a92.jpeg',
        NOW(),
        NOW()
      );
    `);
    console.log(`✓ Inserted Danu's Ark Presa Canario Litter (${litterId})`);
  } else {
    console.log("Litter already exists on PROD.");
  }

  console.log("\nLitter seeding complete!");
}

run().catch(console.error);
