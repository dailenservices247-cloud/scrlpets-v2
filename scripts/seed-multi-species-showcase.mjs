import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const PROD_REF = "qygdixvmxrezhavvnkgc";
const OWNER_ID = "7ce63264-282e-49c8-95f9-0a5e760950da";

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

async function run() {
  console.log("=== Seeding Multi-Species Universal Showcase on PROD ===");

  // 1. Insert Multi-Species Creatures
  console.log("1. Upserting multi-species creatures (Ant Colony, Crested Gecko, Holland Lop)...");
  const creaturesSql = `
    INSERT INTO public.creatures (
      id, owner_id, name, species, slug, breed, color,
      avatar_url, creature_role, page_visible, in_roster,
      is_founder, health_notes, birth_date, created_at
    ) VALUES 
    (
      'c1000000-0000-4000-8000-000000000001',
      '${OWNER_ID}',
      'Nova Colony',
      'insect',
      'nova-colony',
      'Tetramorium immigrans (Pavement Ant)',
      'Dark Brown / Amber',
      'https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=800&auto=format&fit=crop&q=80',
      'pet',
      true,
      true,
      true,
      'Captive-founded fertile queen with 25+ nanitic workers and healthy brood clutch (eggs, larvae, pupae). Maintained in dark claustral test tube setup at 77°F with 20% organic honey water and protein supplementation.',
      '2026-06-15',
      NOW()
    ),
    (
      'c1000000-0000-4000-8000-000000000002',
      '${OWNER_ID}',
      'Solaria',
      'reptile',
      'solaria-gecko',
      'Lilly White Morph',
      'High-Contrast Cream & Yellow',
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
      'pet',
      true,
      true,
      true,
      'Captive-bred Lilly White crested gecko from clean genetic lineage. Complete tail, active nocturnal feeding on Pangea Fruit Mix with Insects and calcium-dusted Dubia roach nymphs.',
      '2026-01-10',
      NOW()
    ),
    (
      'c1000000-0000-4000-8000-000000000003',
      '${OWNER_ID}',
      'Bramble',
      'rabbit',
      'bramble-lop',
      'Holland Lop',
      'Tortoise Shell & Cream',
      'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
      'pet',
      true,
      true,
      true,
      'Purebred Holland Lop buck. Microchipped, vet health check clear, fully vaccinated against RHDV2. Free-roam litter box trained with unlimited Timothy hay and fresh greens diet.',
      '2025-09-20',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      species = EXCLUDED.species,
      slug = EXCLUDED.slug,
      breed = EXCLUDED.breed,
      color = EXCLUDED.color,
      avatar_url = EXCLUDED.avatar_url,
      creature_role = 'pet',
      health_notes = EXCLUDED.health_notes,
      page_visible = true,
      in_roster = true;
  `;
  const creatureRes = await query(creaturesSql);
  console.log("✓ Creatures upserted:", creatureRes);

  // 2. Insert Marketplace Listings
  console.log("2. Upserting multi-species marketplace listings...");
  const listingsSql = `
    INSERT INTO public.listings (
      id, seller_id, creature_id, title, description,
      price_cents, currency, category, availability, listing_kind,
      media_url, created_at, updated_at
    ) VALUES
    (
      'd1000000-0000-4000-8000-000000000001',
      '${OWNER_ID}',
      'c1000000-0000-4000-8000-000000000001',
      'Tetramorium immigrans — Fertile Queen & 25 Nanitics Colony',
      'Healthy, thriving founding ant colony featuring an active fertile queen ant and 25+ first generation workers (nanitics) with eggs and larvae. Shipped in moisture-secure claustral test tube setup with insulated packaging. Includes Live Arrival Guarantee (LAG) with 2-hour unboxing confirmation.',
      4500,
      'usd',
      'animal',
      'available',
      'sale',
      'https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=800&auto=format&fit=crop&q=80',
      NOW(),
      NOW()
    ),
    (
      'd1000000-0000-4000-8000-000000000002',
      '${OWNER_ID}',
      'c1000000-0000-4000-8000-000000000002',
      'Captive-Bred Lilly White Crested Gecko (Correlophus ciliatus)',
      'Striking high-contrast Lilly White crested gecko juvenile from clean lineage. Established on Pangea gecko diet and dusted insects. Complete tail, healthy calcium reserves. Overnight priority reptile shipping or local Toledo, OH pickup.',
      35000,
      'usd',
      'animal',
      'available',
      'sale',
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
      NOW(),
      NOW()
    ),
    (
      'd1000000-0000-4000-8000-000000000003',
      '${OWNER_ID}',
      'c1000000-0000-4000-8000-000000000003',
      'Pedigreed Holland Lop Buck (Tortoise Shell Pattern)',
      'Gentle, friendly purebred Holland Lop. Excellent companion temperament, litter trained, loves socialization and Timothy hay treats. Health record dossier and transition diet included.',
      12000,
      'usd',
      'animal',
      'available',
      'sale',
      'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      price_cents = EXCLUDED.price_cents,
      media_url = EXCLUDED.media_url,
      availability = 'available';
  `;
  const listingRes = await query(listingsSql);
  console.log("✓ Listings upserted:", listingRes);

  // 3. Insert Community Feed Posts
  console.log("3. Upserting community feed posts with multi-species tags...");
  const postsSql = `
    INSERT INTO public.posts (
      id, author_id, content_type, body, media_url,
      tagged_creature_id, created_at, updated_at, comments_enabled
    ) VALUES
    (
      'f1000000-0000-4000-8000-000000000001',
      '${OWNER_ID}',
      'post',
      'Exciting colony milestone today! Nova Colony has crossed 25 nanitic workers and the queen just laid another fresh brood cluster of 15+ eggs. Attached their hydration nest setup and feeding schedule. #antkeeping #queenant #antcolonies',
      'https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=800&auto=format&fit=crop&q=80',
      'c1000000-0000-4000-8000-000000000001',
      NOW() - INTERVAL '2 hours',
      NOW(),
      true
    ),
    (
      'f1000000-0000-4000-8000-000000000002',
      '${OWNER_ID}',
      'post',
      'Solaria just completed a clean, full-body shed overnight! Her dorsal cream pattern is looking sharper than ever. Bioactive vivarium dialed into 75°F ambient and 65% humidity. #reptiles #crestedgecko #herpetology',
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
      'c1000000-0000-4000-8000-000000000002',
      NOW() - INTERVAL '5 hours',
      NOW(),
      true
    ),
    (
      'f1000000-0000-4000-8000-000000000003',
      '${OWNER_ID}',
      'post',
      'Bramble enjoying morning orchard grass and fresh romaine. Daily groom check complete—dense winter coat coming in beautifully. #hollandlop #bunnies #petcare',
      'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
      'c1000000-0000-4000-8000-000000000003',
      NOW() - INTERVAL '8 hours',
      NOW(),
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      body = EXCLUDED.body,
      media_url = EXCLUDED.media_url;
  `;
  const postRes = await query(postsSql);
  console.log("✓ Posts upserted:", postRes);

  console.log("=== Multi-Species Universal Showcase Seeding Complete ===");
}

run().catch(console.error);
