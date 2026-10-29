import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const PROD_REF = "qygdixvmxrezhavvnkgc";
const PROD_OWNER_ID = "7ce63264-282e-49c8-95f9-0a5e760950da";
const PROD_BRAND_ID = "20f32b0b-dfc8-4959-b644-6086cde18c8e";
const BIG_MEECH_ID = "72f5c2da-c822-4b7a-a9f4-923d853bdc2b";
const OLIVER_ID = "d2c24c95-3d1c-47b2-8b8f-9ac61da1700b";

async function query(projRef, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  return res.json();
}

async function run() {
  console.log("=== Upgrading Feed Content on PROD ===");

  // 1. Update Post 1 (Kennel intro & founding mission)
  await query(PROD_REF, `
    UPDATE public.posts
    SET 
      posting_as_type = 'brand',
      brand_id = '${PROD_BRAND_ID}',
      media_url = 'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/205bc3c7-c42f-4bbe-9682-7253039a233d.jpeg',
      pinned_at = NOW(),
      updated_at = NOW()
    WHERE id = 'b1000000-0000-4000-8000-000000000001';
  `);
  console.log("✓ Updated Post 1: Danu's Ark pinned introduction with photo & brand attribution");

  // 2. Update Post 2 (Big Meech Pedigree & UKC Stud Showcase)
  await query(PROD_REF, `
    UPDATE public.posts
    SET 
      posting_as_type = 'brand',
      brand_id = '${PROD_BRAND_ID}',
      tagged_creature_id = '${BIG_MEECH_ID}',
      media_url = 'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/1f3b3a35-bd02-43af-9b1e-f6780b500a92.jpeg',
      body = 'UKC Registered Perro de Presa Canario · Big Meech (Cert #D191-225).\n\nHeavy-boned, stable working temperament, triple-generation verified pedigree. Sired by Legend De Toledo Presa (D100-758, by Tanto De Arsenal out of W Hera De La Arena) out of CH Toledo Presas Legend Of Orisha (P932-651, by DRK Boojawh out of Backups Stella).\n\nStanding at stud to approved working females with verifiable health clearances.',
      updated_at = NOW()
    WHERE id = 'b1000000-0000-4000-8000-000000000002';
  `);
  console.log("✓ Updated Post 2: Big Meech Presa Canario Stud Profile with UKC Pedigree");

  // 3. Update Post 3 (Oliver Cane Corso Profile)
  await query(PROD_REF, `
    UPDATE public.posts
    SET 
      posting_as_type = 'brand',
      brand_id = '${PROD_BRAND_ID}',
      tagged_creature_id = '${OLIVER_ID}',
      media_url = 'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/81f78c35-195a-4d27-9ed0-eab8a1e04b02.jpeg',
      body = 'Oliver · Cane Corso (MNC\'s The Green Arrow "Oliver Queen", born 2022-01-30).\n\nHigh athletic drive, balanced environmental confidence, and clean working structure. Complete veterinary health verification on record with Heatherdowns Veterinary Clinic in Toledo.',
      updated_at = NOW()
    WHERE id = 'b1000000-0000-4000-8000-000000000003';
  `);
  console.log("✓ Updated Post 3: Oliver Cane Corso Profile with verified clinic history");

  // 4. Insert Post 4: Working Conditioning & Yard Work
  const post4Exists = await query(PROD_REF, `
    SELECT id FROM public.posts WHERE body LIKE '%Springyard resistance sprint%' LIMIT 1;
  `);
  if (!Array.isArray(post4Exists) || post4Exists.length === 0) {
    await query(PROD_REF, `
      INSERT INTO public.posts (
        id, author_id, content_type, body, media_url, tagged_creature_id,
        posting_as_type, brand_id, comments_enabled, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        '${PROD_OWNER_ID}',
        'post',
        'Springyard resistance sprint and obedience work with the Presas. Building clean bone density, spring, and core stability without overstressing growth plates.\n\nProper structure starts with disciplined conditioning and clear handler communication.',
        'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/613066c4-25f5-44c1-aa67-31f6748a149f.jpeg',
        '${BIG_MEECH_ID}',
        'brand',
        '${PROD_BRAND_ID}',
        true,
        NOW() - INTERVAL '3 hours',
        NOW()
      );
    `);
    console.log("✓ Inserted Post 4: Working conditioning and obedience sprints");
  } else {
    console.log("Post 4 already exists.");
  }

  // 5. Insert Post 5: High-Drive Nutrition & Fueling
  const post5Exists = await query(PROD_REF, `
    SELECT id FROM public.posts WHERE body LIKE '%High-drive working breeds burn serious fuel%' LIMIT 1;
  `);
  if (!Array.isArray(post5Exists) || post5Exists.length === 0) {
    await query(PROD_REF, `
      INSERT INTO public.posts (
        id, author_id, content_type, body, media_url,
        posting_as_type, brand_id, comments_enabled, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        '${PROD_OWNER_ID}',
        'post',
        'High-drive working breeds burn serious fuel. The Danu\'s Ark nutrition regime: pasture-raised raw beef muscle cuts, bone-in poultry for bioavailable calcium, wild-caught salmon oil for joint lubrication, and targeted probiotics.\n\nHigh working stamina starts in the bowl.',
        'https://qygdixvmxrezhavvnkgc.supabase.co/storage/v1/object/public/media/7ce63264-282e-49c8-95f9-0a5e760950da/a4f90602-10a7-47ba-be99-7e3ae225e12f.jpeg',
        'brand',
        '${PROD_BRAND_ID}',
        true,
        NOW() - INTERVAL '1 hour',
        NOW()
      );
    `);
    console.log("✓ Inserted Post 5: High-Drive Nutrition & Raw Transition Regime");
  } else {
    console.log("Post 5 already exists.");
  }

  console.log("\n=== Checking DEV Feed ===");
  const DEV_REF = "irpayabloogarxwtjmrf";
  const DEV_OWNER = "911e7e22-0eae-437f-b402-2d7fdd6f630f";
  const DEV_BRAND = "a10bec86-6f24-409e-8ee8-5e427ee3b62e";

  const devExisting = await query(DEV_REF, `
    SELECT id FROM public.posts WHERE author_id = '${DEV_OWNER}' LIMIT 1;
  `);
  if (!Array.isArray(devExisting) || devExisting.length === 0) {
    await query(DEV_REF, `
      INSERT INTO public.posts (
        id, author_id, content_type, body, posting_as_type, brand_id, comments_enabled, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        '${DEV_OWNER}',
        'post',
        'Danu''s Ark working molosser showcase.\n\nUKC registered Presa Canario and Cane Corso working lines.\n\nComplete pedigree transparency on the pack tree.',
        'brand',
        '${DEV_BRAND}',
        true,
        NOW(),
        NOW()
      );
    `);
    console.log("✓ Inserted DEV showcase post");
  } else {
    console.log("DEV showcase post already exists.");
  }

  console.log("\nFeed seeding complete!");
}

run().catch(console.error);
