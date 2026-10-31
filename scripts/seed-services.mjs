import { execSync } from "child_process";

const token = execSync("security find-generic-password -s scrlpets-v2-supabase-token -w", { encoding: "utf8" }).trim();

const SERVICES = [
  {
    name: "Stud Service & Chilled Semen Shipping",
    category: "other",
    priceCents: 250000,
    area: "Nationwide Semen Shipping / Midwest On-Site",
    description: "Champion bloodline Cane Corso stud service. Health tested (OFA Hips/Elbows, Cardiac Clear, DNA full panel). We offer natural breeding, AI on-site, and overnight chilled/frozen semen shipping worldwide via FedEx Priority.",
    contactNote: "Message through Deal Room for pedigree records, stud contracts, and progesterone timing coordination.",
    mediaUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80",
    bookingEnabled: true,
    depositRequired: true,
    depositAmountCents: 50000,
    bookingNotice: "Requires current negative Brucellosis test within 14 days and veterinary breeding soundness exam.",
    serviceTierRates: [
      { id: "tier_fresh", name: "Fresh Chilled Semen (Overnight FedEx Priority)", priceCents: 250000, description: "Includes centrifuge collection, extender, insulated shipping box, and priority delivery." },
      { id: "tier_frozen", name: "Frozen Semen (Liquid Nitrogen Tank Shipping)", priceCents: 275000, description: "Includes certified vapor shipper rental and stored straw release." },
      { id: "tier_natural", name: "Natural Tie / On-Site AI (Ohio Facility)", priceCents: 225000, description: "Up to 3 supervised breedings across 48-hour ovulation window." }
    ]
  },
  {
    name: "White-Glove Nationwide Pet Ground Transport",
    category: "transport",
    priceCents: 85000,
    area: "Lower 48 Nationwide Door-to-Door",
    description: "USDA/USDOT certified door-to-door ground pet relocation. Climate-controlled vehicles, non-stop 2-driver teams, 4-hour relief & sanitation stops, and live GPS tracking for puppy families and breeders.",
    contactNote: "Coordinate exact route dates and pickup windows directly in Deal Room.",
    mediaUrl: "https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=800&q=80",
    bookingEnabled: true,
    depositRequired: true,
    depositAmountCents: 20000,
    bookingNotice: "All animals must have an interstate Certificate of Veterinary Inspection (CVI/Health Certificate) issued within 10 days of travel.",
    serviceTierRates: [
      { id: "tier_regional", name: "Regional Ground Relay (Under 500 Miles)", priceCents: 55000, description: "Same-day or next-morning door-to-door direct delivery." },
      { id: "tier_crosscountry", name: "Coast-to-Coast Ground Transport (500-2,000 Miles)", priceCents: 95000, description: "Full interstate transport with 24/7 video and photo updates." },
      { id: "tier_vip", name: "Solo VIP Transport (Direct Non-Stop Van)", priceCents: 160000, description: "Dedicated private van solely for your pet, zero crate sharing." }
    ]
  },
  {
    name: "Elite Working Dog & Puppy Socialization Residency",
    category: "training",
    priceCents: 220000,
    area: "Toledo, Cleveland, Columbus & Surrounding",
    description: "Comprehensive 4-week board-and-train curriculum tailored for working molossers and guardians. Environmental neutrality, engagement drive, crate conditioning, loose-leash walking, and off-leash recall.",
    contactNote: "Includes weekly video progress reports and a 2-hour owner transfer seminar upon graduation.",
    mediaUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80",
    bookingEnabled: true,
    depositRequired: true,
    depositAmountCents: 40000,
    bookingNotice: "Evaluation assessment required prior to drop-off. Dogs must be up to date on DHPP, Rabies, and Bordetella.",
    serviceTierRates: [
      { id: "tier_puppy", name: "Puppy Imprinting & Foundation (8-16 Weeks, 2 Weeks)", priceCents: 120000, description: "Socialization, crate conditioning, food engagement, potty protocol." },
      { id: "tier_comprehensive", name: "Comprehensive Off-Leash Obedience (4 Weeks Residency)", priceCents: 220000, description: "Full on/off-leash commands, distraction proofing, impulse control." },
      { id: "tier_protection", name: "Working K9 Protection & Drive Foundations (6 Weeks)", priceCents: 320000, description: "Tug foundation, clean release, perimeter alert, and active bark-and-hold." }
    ]
  },
  {
    name: "Premium Hydro-Bath, Deshed & Coat Conditioning",
    category: "grooming",
    priceCents: 8500,
    area: "Facility Drop-off or Mobile Grooming Unit",
    description: "Therapeutic bathing and high-velocity deshedding service using all-natural oatmeal and hypoallergenic cleansers. Includes ear flush, sanitary trim, nail dremel shaping, and blueberry facial scrub.",
    contactNote: "Appointments available 7 days a week. Same-day bookings accepted when space permits.",
    mediaUrl: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80",
    bookingEnabled: true,
    depositRequired: false,
    depositAmountCents: null,
    bookingNotice: "Please arrive 10 minutes early. Let us know if your pet has skin sensitivities or needs special handling.",
    serviceTierRates: [
      { id: "tier_bath", name: "Standard Spa Bath & Nail Dremel (Short-Coat)", priceCents: 7500, description: "Warm hydro-surge wash, ear clean, paw pad moisture balm, nail grind." },
      { id: "tier_deshed", name: "Heavy Double-Coat Blowout & Undercoat Deshedding", priceCents: 11500, description: "De-shed shampoo soak, high-velocity blowout, undercoat rake finish." },
      { id: "tier_conformation", name: "Full Breed Conformation Trim & Conditioning", priceCents: 14500, description: "Show-ready preparation with precision scissor work and gloss treatment." }
    ]
  },
  {
    name: "Climate-Controlled Canine Boarding & Conditioning Suites",
    category: "boarding",
    priceCents: 6500,
    area: "Kennel Facility Suites",
    description: "Luxury individual boarding suites with radiant floor heating, private outdoor turnout patios, Kuranda orthopedic cots, and daily supervised pack or solo pasture exercise on our 5-acre property.",
    contactNote: "24/7 on-site caretaker supervision. Live camera access available on request.",
    mediaUrl: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80",
    bookingEnabled: true,
    depositRequired: true,
    depositAmountCents: 10000,
    bookingNotice: "Food must be individually portioned in sealed bags. Medication administered at no extra charge.",
    serviceTierRates: [
      { id: "tier_suite", name: "Executive Suite (Nightly Rate with 4 Daily Turnouts)", priceCents: 6500, description: "Indoor/outdoor climate suite, Kuranda cot, 4 daily pasture play sessions." },
      { id: "tier_conditioning", name: "Conditioning & Treadmill Boarding Package (Daily Workout)", priceCents: 8500, description: "Includes slatmill cardio and muscle conditioning routine." },
      { id: "tier_extended", name: "Extended Stay (14+ Days, Includes Free Bath & Nail Trim)", priceCents: 5500, description: "Discounted per-night rate for stays over two weeks." }
    ]
  },
  {
    name: "Pedigree Conformation & Action Photography",
    category: "photography",
    priceCents: 35000,
    area: "Midwest On-Location or Studio",
    description: "High-speed professional canine photography specializing in conformation stacks, working bite-work action, headshots, and puppy litter announcements for breeders and kennel portfolios.",
    contactNote: "We bring full portable lighting equipment to your kennel or training grounds.",
    mediaUrl: "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=800&q=80",
    bookingEnabled: true,
    depositRequired: true,
    depositAmountCents: 10000,
    bookingNotice: "Sessions depend on weather for outdoor locations. Re-shoots provided at no charge if weather does not cooperate.",
    serviceTierRates: [
      { id: "tier_single", name: "Single Dog Conformation & Portrait Session (10 Photos)", priceCents: 35000, description: "10 retouched high-resolution images delivered in digital web & print formats." },
      { id: "tier_litter", name: "Full Litter Puppy Showcase (Individual Stacks + Group Shots)", priceCents: 55000, description: "All puppies stacked, individual closeups, and group whelping shots." },
      { id: "tier_kennel", name: "Kennel Brand OS Portfolio Day (Up to 6 Dogs, Video B-Roll)", priceCents: 95000, description: "Full half-day media shoot covering all breeding stock and video clips." }
    ]
  }
];

async function seedProjectServices(projRef, label, brandId, ownerId) {
  console.log(`\n--- Seeding Services for ${label} (${projRef}) ---`);

  // Check if items already exist
  const checkRes = await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `SELECT name FROM public.services WHERE brand_id = '${brandId}';`
    })
  });
  const existingRows = await checkRes.json();
  const existingNames = new Set(Array.isArray(existingRows) ? existingRows.map(r => r.name) : []);

  const toInsert = SERVICES.filter(s => !existingNames.has(s.name));
  console.log(`Found ${existingNames.size} existing services. Inserting ${toInsert.length} new services...`);

  if (toInsert.length === 0) {
    console.log(`All services already exist in ${label}.`);
    return;
  }

  for (const s of toInsert) {
    const tierJson = JSON.stringify(s.serviceTierRates).replace(/'/g, "''");
    const query = `
      INSERT INTO public.services (
        owner_id,
        brand_id,
        name,
        description,
        category,
        price_cents,
        currency,
        area,
        contact_note,
        media_url,
        active,
        booking_enabled,
        deposit_required,
        deposit_amount_cents,
        service_tier_rates,
        booking_notice
      ) VALUES (
        '${ownerId}'::uuid,
        '${brandId}'::uuid,
        $name$${s.name}$name$,
        $desc$${s.description}$desc$,
        '${s.category}',
        ${s.priceCents},
        'usd',
        $area$${s.area}$area$,
        $note$${s.contactNote}$note$,
        $url$${s.mediaUrl}$url$,
        true,
        ${s.bookingEnabled},
        ${s.depositRequired},
        ${s.depositAmountCents === null ? "NULL" : s.depositAmountCents},
        '${tierJson}'::jsonb,
        $notice$${s.bookingNotice}$notice$
      ) RETURNING id, name;
    `;

    const res = await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const result = await res.json();
    if (res.status !== 201 && res.status !== 200) {
      console.error(`Error inserting ${s.name}:`, result);
    } else {
      console.log(`✓ Inserted service: ${s.name}`);
    }
  }
}

async function main() {
  // DEV
  await seedProjectServices(
    "irpayabloogarxwtjmrf",
    "DEV",
    "a10bec86-6f24-409e-8ee8-5e427ee3b62e",
    "911e7e22-0eae-437f-b402-2d7fdd6f630f"
  );

  // PROD
  await seedProjectServices(
    "qygdixvmxrezhavvnkgc",
    "PROD",
    "20f32b0b-dfc8-4959-b644-6086cde18c8e",
    "7ce63264-282e-49c8-95f9-0a5e760950da"
  );

  console.log("\nServices seeding complete!");
}

main().catch(console.error);
