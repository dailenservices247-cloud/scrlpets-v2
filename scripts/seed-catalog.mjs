import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const PRODUCTS = [
  {
    title: "Organic Salmon & Sweet Potato Kibble (30 lb)",
    priceCents: 6499,
    category: "Food",
    sku: "FOOD-SALM-30",
    stock: 45,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=800&q=80",
    description: "Grain-free premium formula with active probiotics and omega fatty acids for optimal coat health and working stamina."
  },
  {
    title: "Freeze-Dried Raw Beef & Organs Meal Topper (16 oz)",
    priceCents: 2999,
    category: "Food",
    sku: "FOOD-RAW-16",
    stock: 60,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=800&q=80",
    description: "100% grass-fed raw beef heart, liver, and muscle meat. Single-ingredient nutrition boost for high-drive canines."
  },
  {
    title: "Heavy-Duty Escape-Proof Working Dog Crate (42 in)",
    priceCents: 18900,
    category: "Crates",
    sku: "CRATE-HD-42",
    stock: 15,
    shippingCents: 1500,
    mediaUrl: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?auto=format&fit=crop&w=800&q=80",
    description: "Reinforced high-tensile steel tube construction with anti-escape dual deadbolts and easy-clean slide-out pan."
  },
  {
    title: "Orthopedic High-Density Memory Foam Dog Bed (XL)",
    priceCents: 8900,
    category: "Beds",
    sku: "BED-ORTHO-XL",
    stock: 25,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80",
    description: "4-inch solid orthopedic medical-grade memory foam with waterproof lining and tear-resistant machine-washable microsuede cover."
  },
  {
    title: "Biothane All-Weather Tactical Working Lead (6 ft)",
    priceCents: 2800,
    category: "Gear",
    sku: "LEAD-BIO-6FT",
    stock: 50,
    shippingCents: 499,
    mediaUrl: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80",
    description: "100% waterproof, odor-proof synthetic webbing with solid brass hardware. Rated up to 1,000 lbs break strength."
  },
  {
    title: "Heavy-Duty Cobra Buckle Tactical K9 Harness",
    priceCents: 4850,
    category: "Gear",
    sku: "HARN-K9-TAC",
    stock: 30,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80",
    description: "1050D military-spec nylon with metal quick-release buckles, dual D-rings, and control handle for working molossers."
  },
  {
    title: "Stainless Steel Anti-Gulp Slow Feeder Bowl (2L)",
    priceCents: 1899,
    category: "Bowls",
    sku: "BOWL-SLOW-SS",
    stock: 75,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1535294435445-d7249524ef2e?auto=format&fit=crop&w=800&q=80",
    description: "Food-grade rustproof 304 stainless steel with center obstacle dome to prevent bloat and promote healthy digestion."
  },
  {
    title: "Professional High-Velocity Pet Hair Dryer & Blaster",
    priceCents: 11900,
    category: "Grooming",
    sku: "GROOM-DRY-3HP",
    stock: 12,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80",
    description: "Stepless adjustable speed 3.2 HP motor with heat selector and 3 interchangeable nozzles for double-coated breeds."
  },
  {
    title: "Stainless Steel Undercoat Deshedding Rake",
    priceCents: 1650,
    category: "Grooming",
    sku: "GROOM-RAKE-SS",
    stock: 80,
    shippingCents: 350,
    mediaUrl: "https://images.unsplash.com/photo-1522276498395-f4f68f7f8454?auto=format&fit=crop&w=800&q=80",
    description: "Dual-sided rounded teeth gently clear dead undercoat and mats without scratching sensitive skin."
  },
  {
    title: "Glucosamine & Chondroitin Joint Health Chews (120 ct)",
    priceCents: 3600,
    category: "Health",
    sku: "HLTH-JOINT-120",
    stock: 40,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80",
    description: "Advanced joint support with Glucosamine, Chondroitin, MSM, and Turmeric for large-breed mobility and hip support."
  },
  {
    title: "Organic Cold-Pressed Wild Alaskan Salmon Oil (32 fl oz)",
    priceCents: 2499,
    category: "Health",
    sku: "HLTH-OIL-32OZ",
    stock: 55,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1608096299210-db7e38487075?auto=format&fit=crop&w=800&q=80",
    description: "Pure wild-caught Alaskan salmon oil rich in EPA and DHA omega-3s. Promotes shiny coats and immune function."
  },
  {
    title: "Indestructible Natural Rubber Tire & Chew Toy",
    priceCents: 1499,
    category: "Toys",
    sku: "TOY-RUBR-TIRE",
    stock: 90,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80",
    description: "Ultra-durable non-toxic natural rubber designed for powerful jaws. Stuffable with treats and peanut butter."
  },
  {
    title: "Elevated Cooling Cot Bed with Breathable Mesh (Large)",
    priceCents: 4200,
    category: "Beds",
    sku: "BED-COT-LG",
    stock: 20,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=800&q=80",
    description: "Off-the-ground airflow cot with powder-coated steel frame and durable Teslin fabric. Ideal for indoor and outdoor use."
  },
  {
    title: "Hands-Free Bungee Running & Hiking Leash",
    priceCents: 2650,
    category: "Gear",
    sku: "LEAD-BUNG-RUN",
    stock: 35,
    shippingCents: 0,
    mediaUrl: "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=800&q=80",
    description: "Shock-absorbing dual bungee with adjustable reflective waist belt and two neoprene-padded traffic handles."
  },
  {
    title: "Puppy Whelping & Playpen Expandable Enclosure (8-Panel)",
    priceCents: 7900,
    category: "Crates",
    sku: "CRATE-PLAY-8P",
    stock: 18,
    shippingCents: 1000,
    mediaUrl: "https://images.unsplash.com/photo-1591824438708-ce405f36ba3d?auto=format&fit=crop&w=800&q=80",
    description: "Heavy-duty rustproof coated wire exercise pen with walk-through latch door. Configurable into octagon, rectangle, or divider."
  }
];

async function seedProject(projRef, label, brandId, sellerId, merchantName) {
  console.log(`\n--- Seeding ${label} (${projRef}) ---`);

  // Check if items already exist
  const checkRes = await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `SELECT external_sku FROM public.listings WHERE brand_id = '${brandId}' AND external_sku IS NOT NULL;`
    })
  });
  const existingRows = await checkRes.json();
  const existingSkus = new Set(Array.isArray(existingRows) ? existingRows.map(r => r.external_sku) : []);

  const toInsert = PRODUCTS.filter(p => !existingSkus.has(p.sku));
  console.log(`Found ${existingSkus.size} existing items. Inserting ${toInsert.length} new items...`);

  if (toInsert.length === 0) {
    console.log(`All products already exist in ${label}.`);
    return;
  }

  for (const p of toInsert) {
    const query = `
      INSERT INTO public.listings (
        seller_id,
        brand_id,
        posting_as_type,
        about_type,
        title,
        price_cents,
        currency,
        availability,
        listing_kind,
        category,
        seller_source,
        merchant_name,
        external_sku,
        stock_quantity,
        shipping_fee_cents,
        fulfillment_options,
        deposit_bps,
        inspection_hours,
        sale_mode,
        description,
        media_url
      ) VALUES (
        '${sellerId}'::uuid,
        '${brandId}'::uuid,
        'brand'::posting_as_type,
        'none'::about_type,
        $title$${p.title}$title$,
        ${p.priceCents},
        'usd',
        'available',
        'sale',
        $cat$${p.category}$cat$,
        'merchant',
        $merch$${merchantName}$merch$,
        $sku$${p.sku}$sku$,
        ${p.stock},
        ${p.shippingCents},
        ARRAY['shipping']::text[],
        0,
        48,
        'direct_checkout',
        $desc$${p.description}$desc$,
        $url$${p.mediaUrl}$url$
      ) RETURNING id, title;
    `;

    const res = await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const result = await res.json();
    if (res.status !== 201 && res.status !== 200) {
      console.error(`Error inserting ${p.sku}:`, result);
    } else {
      console.log(`✓ Inserted [${p.sku}] ${p.title}`);
    }
  }
}

async function main() {
  // DEV:
  await seedProject(
    "irpayabloogarxwtjmrf",
    "DEV",
    "a10bec86-6f24-409e-8ee8-5e427ee3b62e",
    "911e7e22-0eae-437f-b402-2d7fdd6f630f",
    "Danu's Ark Provisions"
  );

  // PROD:
  await seedProject(
    "qygdixvmxrezhavvnkgc",
    "PROD",
    "20f32b0b-dfc8-4959-b644-6086cde18c8e",
    "7ce63264-282e-49c8-95f9-0a5e760950da",
    "Danu's Ark Provisions"
  );

  console.log("\nCatalog seeding complete!");
}

main().catch(console.error);
