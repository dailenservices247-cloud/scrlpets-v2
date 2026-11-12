export type SynergyPersonaId = "personal" | "creator" | "brand_os";

export type GenUiModeId = "thumb" | "cinematic" | "studio" | "calm";

export type TechVerticalPillarId = "hardware" | "gaming" | "ai_work_stack";

export type FoodVerticalPillarId = "local_eats" | "recipes" | "chef_drops";

export type MessengerVerticalFilter = "all" | "scrlpets" | "tech_gaming" | "food_recipes" | "synergy";

export interface VerticalNameCandidate {
  id: string;
  name: string;
  tagline: string;
  rationale: string;
}

/**
 * Single-word coined / aspirational names following Dailen's Naming Taste Heuristic
 * (AI Hub/Brand/dailen-taste-profile.md):
 * - Single words > coined > abstract
 * - Zero tired prefixes (Neo-/Pro-/X-/Cyber-/Hyper-/Smart-/Quick-)
 * - Zero tired suffixes (-Hub/-Lab/-Studio/-ify/-ly/-ai)
 */
export const TECH_VERTICAL_NAME_CANDIDATES: VerticalNameCandidate[] = [
  {
    id: "anvil",
    name: "Anvil",
    tagline: "Rigs, Gaming & AI Work Stacks — Built & Verified.",
    rationale:
      "Single punchy noun. Captures custom PC building, hardware modding, gaming loadouts, and forging AI workflows without sounding corporate.",
  },
  {
    id: "vektor",
    name: "Vektor",
    tagline: "High-Frame Hardware, Competitive Gaming & Agent Stacks.",
    rationale:
      "Sharp coined spelling. Bridges GPU shaders/3D gaming engines, hardware velocity, and AI vector intelligence in one word.",
  },
  {
    id: "crucible",
    name: "Crucible",
    tagline: "Stress-Tested Rigs, Mods & Operator Workflows.",
    rationale:
      "Evokes both competitive gaming arenas and hardware/AI benchmark stress-testing where only verified builds pass.",
  },
  {
    id: "praxis",
    name: "Praxis",
    tagline: "Applied Tech, Custom Builds & Sovereign AI.",
    rationale:
      "Classic single-word sibling to Apotheosis—means turning knowledge into real-world action, hardware, and execution.",
  },
  {
    id: "verge",
    name: "Verge",
    tagline: "Next-Gen Rigs, Mod Culture & AI Systems.",
    rationale:
      "Clean, mainstream consumer feel that fits right alongside Scrlpets and Synergy on an iOS/Android home screen.",
  },
];

export const FOOD_VERTICAL_NAME_CANDIDATES: VerticalNameCandidate[] = [
  {
    id: "savor",
    name: "Savor",
    tagline: "Verified Local Eats, Recipe Lineage & Chef Drops.",
    rationale:
      "Clean, single-word consumer brand. Immediately signals real food culture, 9:16 taste tests, and recipes worth slowing down for.",
  },
  {
    id: "palate",
    name: "Palate",
    tagline: "Receipt-Verified Reviews, Flavor Trees & Kitchen Passports.",
    rationale:
      "Elevated single word that turns every user's taste profile and recipe remix history into a verified culinary identity.",
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Live Kitchens, Food Trucks, Real Reviews & Heirloom Recipes.",
    rationale:
      "Warm, primal, and magnetic. Bridges backyard smokers, local taco trucks, and home kitchen creators under one roof.",
  },
  {
    id: "crave",
    name: "Crave",
    tagline: "9:16 Food Reels, Forkable Recipes & Instant Local Pickup.",
    rationale:
      "High-velocity daily habit word—built for the 3x-a-day 'what are we eating right now?' scroll loop.",
  },
  {
    id: "hearth",
    name: "Hearth",
    tagline: "Family Recipe Trees, Local Kitchens & Trusted Hospitality.",
    rationale:
      "Anchors the heritage side of food—passing down multi-generation recipes and supporting neighborhood spots.",
  },
];

export interface SynergyStoreModule {
  id: string;
  name: string;
  category: "Core Vertical" | "Connected App" | "Intelligence" | "Privacy & Care";
  badge: string;
  description: string;
  installedByDefault: boolean;
  lockedCore?: boolean;
  routePreview: "scrlpets" | "tech_vertical" | "food_vertical" | "messenger" | "cosmos";
}

export const SYNERGY_STORE_MODULES: SynergyStoreModule[] = [
  {
    id: "scrlpets",
    name: "Scrlpets",
    category: "Core Vertical",
    badge: "Vertical #1 · LIVE",
    description:
      "Animal-first social vertical, 5-Gen COI pedigrees, whelping forecaster, statutory compliance, and Held Payment QR handovers.",
    installedByDefault: true,
    lockedCore: true,
    routePreview: "scrlpets",
  },
  {
    id: "tech_vertical",
    name: "Anvil (Tech, Gaming & AI)",
    category: "Core Vertical",
    badge: "Vertical #2 · 3 Pillars",
    description:
      "Custom PC & console rigs, gaming clips/mods/streams, and AI work stacks—powered by Rig Dossiers, Parts Trees, and Benchmark Passports.",
    installedByDefault: true,
    routePreview: "tech_vertical",
  },
  {
    id: "food_vertical",
    name: "Savor (Food Reviews & Recipes)",
    category: "Core Vertical",
    badge: "Vertical #3 · Daily Habit",
    description:
      "Receipt-verified local food reviews, forkable Recipe Lineage Trees, creator cookbooks, and no-show protected QR food-truck pickup.",
    installedByDefault: true,
    routePreview: "food_vertical",
  },
  {
    id: "synergy_messenger",
    name: "Synergy Messenger",
    category: "Connected App",
    badge: "Standalone iOS/Android",
    description:
      "Facebook-Messenger-style auto-connected app uniting chats, deal dossiers, and in-person QR code handovers across every vertical.",
    installedByDefault: true,
    lockedCore: true,
    routePreview: "messenger",
  },
  {
    id: "apotheosis_hub",
    name: "Apotheosis Agent Hub",
    category: "Intelligence",
    badge: "§16.7 Substrate",
    description:
      "Plan Mode, Complexity Dial, LLM Council, and Denise co-pilot orchestrating cross-vertical goals.",
    installedByDefault: true,
    routePreview: "cosmos",
  },
  {
    id: "see_through",
    name: "See Through Vault",
    category: "Privacy & Care",
    badge: "Local-Only Audit",
    description:
      "Cryptographic audit timeline showing exactly what AI and connected modules touched—100% on-device.",
    installedByDefault: false,
    routePreview: "cosmos",
  },
  {
    id: "lucid_companion",
    name: "Lucid Companion",
    category: "Privacy & Care",
    badge: "Heart & Hard Facts",
    description:
      "Transparent emotional honesty and grounding layer across your digital life.",
    installedByDefault: false,
    routePreview: "cosmos",
  },
];

export interface TechDossierNode {
  id: string;
  role: string;
  label: string;
  spec: string;
  verified: boolean;
}

export interface TechClearanceBadge {
  label: string;
  value: string;
  status: "passed" | "elite";
}

export interface TechVerticalDossier {
  id: string;
  pillar: TechVerticalPillarId;
  pillarLabel: string;
  title: string;
  subtitle: string;
  builderBrand: string;
  builderHandle: string;
  priceFormatted: string;
  depositFormatted: string;
  efficiencyLabel: string;
  efficiencyValue: string;
  summary: string;
  treeTitle: string;
  nodes: TechDossierNode[];
  passportTitle: string;
  clearances: TechClearanceBadge[];
  reelCaption: string;
  reelViews: string;
  linkedThreadId: string;
}

export const TECH_VERTICAL_DOSSIERS: TechVerticalDossier[] = [
  {
    id: "rig-sovereign-5090",
    pillar: "hardware",
    pillarLabel: "Pillar 1 · Hardware Rigs & Modding",
    title: "Black Sheep Sovereign Workstation (Dual-Loop SFF)",
    subtitle: "Custom Liquid-Cooled PC & Local LLM Rig · Serial #BS247-RIG-01",
    builderBrand: "Black Sheep Mod Lab",
    builderHandle: "@dailen_builds",
    priceFormatted: "$3,850",
    depositFormatted: "$500 Held Payment Deposit",
    efficiencyLabel: "Parts Bottleneck Index",
    efficiencyValue: "1.4% (Zero Bottleneck · Matched Line)",
    summary:
      "Cloned from Scrlpets' Animal Dossier: replaces breed/microchip with verified component serials, custom loop pressure test, and live boot verification.",
    treeTitle: "4-Layer Component & Mod Lineage Tree",
    nodes: [
      {
        id: "gpu",
        role: "Primary Compute (Sire Equivalent)",
        label: "RTX 5090 32GB Founders + EK Quantum Block",
        spec: "VRAM 32GB GDDR7 · Core +185MHz Undervolt",
        verified: true,
      },
      {
        id: "cpu",
        role: "Host Processor (Dam Equivalent)",
        label: "AMD Ryzen 9 9950X3D Delidded",
        spec: "16C/32T · Direct-Die Liquid Metal",
        verified: true,
      },
      {
        id: "mobo",
        role: "Foundation Board",
        label: "ASUS ROG Crosshair X870E Hero",
        spec: "BIOS 1402 Locked · PCIe 5.0 x16",
        verified: true,
      },
      {
        id: "cooling",
        role: "Thermal Architecture",
        label: "Dual 360mm Copper Radiators + Quick-Disconnects",
        spec: "24hr Air-Pressure Leak Test Passed",
        verified: true,
      },
    ],
    passportTitle: "Verified Benchmark & Thermal Passport (Replaces OFA/DNA)",
    clearances: [
      { label: "3DMark Time Spy Extreme", value: "28,410 (Top 1%)", status: "elite" },
      { label: "FurMark 60m Thermal Load", value: "54°C Max GPU / 61°C CPU", status: "passed" },
      { label: "VRAM & MemTest86+ Pass", value: "0 Errors (4 Passes)", status: "passed" },
      { label: "Hardware Serial Provenance", value: "C2PA Camera-Signed Boot Video", status: "elite" },
    ],
    reelCaption: "Cold boot + thermal stress test on the Dual-Loop Sovereign Rig before buyer QR handover.",
    reelViews: "42.8K views · 38 fan tips ⭐️",
    linkedThreadId: "thread-tech-rig-5090",
  },
  {
    id: "gaming-dualsense-mod",
    pillar: "gaming",
    pillarLabel: "Pillar 2 · Gaming, Mods & Streams",
    title: "Apex Hall-Effect DualSense Edge + Frame-Sync Pack",
    subtitle: "Competitive PS5/PC Modded Controller + Custom Shader & OBS Profile",
    builderBrand: "Toledo Custom Modworks",
    builderHandle: "@allday24seven",
    priceFormatted: "$265",
    depositFormatted: "$50 Held Payment Deposit",
    efficiencyLabel: "Input Latency & Drift Rating",
    efficiencyValue: "0.8ms Polling · 0.002% Deadzone",
    summary:
      "Brings daily gamer traffic into Vertical #2: combines physical modded controllers/consoles with downloadable shader packs, squad streams, and clip reels.",
    treeTitle: "Mod & Competitive Loadout Tree",
    nodes: [
      {
        id: "sticks",
        role: "Stick Architecture",
        label: "Calibrated TMR / Hall-Effect Electromagnetic Modules",
        spec: "Zero-Drift Permanent Magnet Sensors",
        verified: true,
      },
      {
        id: "triggers",
        role: "Actuation Layer",
        label: "Omron Micro-Switch Instant Hair Triggers (0.4mm)",
        spec: "Rated 20M Clicks · Tactile Click",
        verified: true,
      },
      {
        id: "paddles",
        role: "Rear Ergonomics",
        label: "4x CNC Aluminum Rear Paddles + Matte Destroyer Gray Shell",
        spec: "Remappable Hardware Chip v4",
        verified: true,
      },
      {
        id: "stream_pack",
        role: "Bundled Digital Mod",
        label: "120fps Low-Latency OBS + Audio EQ Preset Pack",
        spec: "Instant Cloud Import Included",
        verified: true,
      },
    ],
    passportTitle: "Competitive Integrity & Calibration Passport",
    clearances: [
      { label: "Circularity Error Test", value: "1.9% Avg (Tournament Grade)", status: "elite" },
      { label: "USB-C 1000Hz Overclock", value: "Verified 0.8ms Response", status: "passed" },
      { label: "Tournament Compliance", value: "Zero Macro / Legal Hardware Mod", status: "passed" },
      { label: "Live Gameplay Reel Proof", value: "Linked 9:16 Input-Overlay Clip", status: "elite" },
    ],
    reelCaption: "1000Hz input-overlay test + zero-deadzone calibration on the Destroyer Gray build.",
    reelViews: "91.4K views · 115 fan tips ⭐️",
    linkedThreadId: "thread-gaming-dualsense",
  },
  {
    id: "ai-safety-net-stack",
    pillar: "ai_work_stack",
    pillarLabel: "Pillar 3 · AI Workflows, Agents & Work Stack",
    title: "Peer Operator's Multi-Agent Safety Net & Vault OS",
    subtitle: "20 Production Skills + Cross-Tool Parity Harness + Voice Task Queue",
    builderBrand: "Synapse Dynamics Segmented",
    builderHandle: "@dayoneai",
    priceFormatted: "$149",
    depositFormatted: "Instant Protected Digital Escrow",
    efficiencyLabel: "Context Drift Reduction",
    efficiencyValue: "98.4% Spec Parity · 0 Orphan Refs",
    summary:
      "Your digital AI & Work Stack vertical: creators sell and share verified agent skills, n8n/MCP automations, and prompt canons with 1-tap Synergy installation.",
    treeTitle: "Agent Skill & Dependency Lineage Tree",
    nodes: [
      {
        id: "router",
        role: "Root Orchestrator",
        label: "Routing-Before-Acting + SubagentStart Hook",
        spec: "100% Child Agent Skill Reach",
        verified: true,
      },
      {
        id: "safety_net",
        role: "Pre-Build Gate",
        label: "12-Dimension Gap Analysis → PRD → Severity Eval",
        spec: "Blocks Premature Code Mutation",
        verified: true,
      },
      {
        id: "doctrine",
        role: "Craft Engine",
        label: "2-Step Doctrine Injection Canon Dissector",
        spec: "Zero Cold-Model Slop",
        verified: true,
      },
      {
        id: "bridge",
        role: "Mobile Dispatch",
        label: "Phone Co-Pilot → Vault Task Queue Watcher",
        spec: "OAuth 2.1 + Keychain Wrapper",
        verified: true,
      },
    ],
    passportTitle: "Verified Eval & Security Audit Passport",
    clearances: [
      { label: "Cross-Tool Parity Suite", value: "Claude · Codex · Antigravity Green", status: "elite" },
      { label: "Secret Leak & Keychain Gate", value: "0 Plaintext Keys · Wrapper Enforced", status: "passed" },
      { label: "Token Budget Efficiency", value: "_index.md 0.4s Map Resolution", status: "elite" },
      { label: "Sandbox Format Check", value: "100% Markdown/JSON/Shell Audited", status: "passed" },
    ],
    reelCaption: "How one SubagentStart hook took child agent skill usage from 0% to 100% in 60 seconds.",
    reelViews: "64.2K views · 89 fan tips ⭐️",
    linkedThreadId: "thread-tech-rig-5090",
  },
];

export interface FoodVerticalDossier {
  id: string;
  pillar: FoodVerticalPillarId;
  pillarLabel: string;
  title: string;
  subtitle: string;
  creatorBrand: string;
  creatorHandle: string;
  priceFormatted: string;
  depositFormatted: string;
  authenticityLabel: string;
  authenticityValue: string;
  summary: string;
  treeTitle: string;
  nodes: TechDossierNode[];
  passportTitle: string;
  clearances: TechClearanceBadge[];
  reelCaption: string;
  reelViews: string;
  linkedThreadId: string;
}

export const FOOD_VERTICAL_DOSSIERS: FoodVerticalDossier[] = [
  {
    id: "food-otates-birria",
    pillar: "local_eats",
    pillarLabel: "Pillar 1 · Verified Local Spots, Food Trucks & Reviews",
    title: "Taqueria Otates — Jalisco Birria Quesataco Family Pack",
    subtitle: "Receipt-Verified 9.6/10 Local Review + Protected QR Window Pickup",
    creatorBrand: "Taqueria Otates (Verified Brand OS)",
    creatorHandle: "@taqueria_otates",
    priceFormatted: "$38",
    depositFormatted: "$15 No-Show Protected Pre-Order",
    authenticityLabel: "Verified Diner Trust Score",
    authenticityValue: "99.1% Real Receipt Proof (0 Bot Reviews)",
    summary:
      "Solves Yelp fake reviews and food-truck no-shows at once: reviews require a C2PA photo or QR pickup receipt, and pre-orders use Scrlpets' Held Payment QR scan at the truck window.",
    treeTitle: "Culinary Lineage & Sourcing Tree",
    nodes: [
      {
        id: "base_recipe",
        role: "Origin Lineage (Root Recipe)",
        label: "1984 Guadalajara 12-Hour Adobo Short-Rib Consomé",
        spec: "Guajillo · Ancho · Morita · Bone Marrow Stock",
        verified: true,
      },
      {
        id: "protein",
        role: "Primary Sourcing",
        label: "USDA Prime Chuck Roll + Brisket Point Blend",
        spec: "Fresh Daily · Never Frozen Batch #OT-412",
        verified: true,
      },
      {
        id: "tortilla",
        role: "Craft Foundation",
        label: "Nixtamalized Heirloom Corn Tortillas (Griddled in Consomé Fat)",
        spec: "Pressed to Order · Oaxaca Cheese Crust",
        verified: true,
      },
      {
        id: "pickup_queue",
        role: "Fulfillment Protocol",
        label: "Live Truck Queue Slot + QR Window Release",
        spec: "Zero Cold Food · Zero No-Show Waste",
        verified: true,
      },
    ],
    passportTitle: "Verified Taste & Kitchen Passport (Replaces Fake Star Ratings)",
    clearances: [
      { label: "Review Provenance", value: "142 QR-Receipt Verified Reviews", status: "elite" },
      { label: "Health & Prep Inspection", value: "Grade A · Open-Window Prep Reel", status: "passed" },
      { label: "Allergen & Dietary Ledger", value: "100% Gluten-Free Corn · No Seed Oils", status: "elite" },
      { label: "Pickup Window SLA", value: "Hot off the Planche in < 6 Mins", status: "passed" },
    ],
    reelCaption: "First-bite crunch test + dipping into the 12-hour marrow consomé at the Toledo truck window.",
    reelViews: "128.5K views · 210 fan tips ⭐️",
    linkedThreadId: "thread-food-otates",
  },
  {
    id: "food-smoked-oxtail-recipe",
    pillar: "recipes",
    pillarLabel: "Pillar 2 · Forkable Recipe Trees & Creator Cookbooks",
    title: "Hickory-Smoked Bourbon Braised Oxtail & Gouda Grits",
    subtitle: "3-Generation Family Recipe Tree · Interactive Macro & Spice Scaler",
    creatorBrand: "Midwest Smoke & Soul",
    creatorHandle: "@chef_marcus_419",
    priceFormatted: "$12",
    depositFormatted: "Instant Creator Cookbook & Scaling Unlock",
    authenticityLabel: "Cook Success Rate",
    authenticityValue: "96.8% Verified Home Replications",
    summary:
      "Reuses Scrlpets' 5-Gen Pedigree Canvas as a Forkable Recipe Tree: see the Grandmother's original 1978 recipe, the Pitmaster's smoked remix, and the Air-Fryer weeknight version.",
    treeTitle: "3-Generation Recipe & Remix Pedigree Tree",
    nodes: [
      {
        id: "gen1",
        role: "Gen 1 · Founder Recipe (1978)",
        label: "Nana Evelyn's Cast-Iron Sunday Braised Oxtail",
        spec: "4-Hour Dutch Oven · mirepoix + browning sauce",
        verified: true,
      },
      {
        id: "gen2",
        role: "Gen 2 · Pitmaster Remix (2019)",
        label: "2-Hour Post-Oak Smoke Over Open Pan Braise",
        spec: "250°F Smoke Bath before braising liquid seal",
        verified: true,
      },
      {
        id: "gen3",
        role: "Gen 3 · Current Dossier (2026)",
        label: "Bourbon-Maple Reduction + Stone-Ground Smoked Gouda Grits",
        spec: "Auto-scales for 2, 4, or 12 guests with grocery export",
        verified: true,
      },
      {
        id: "macros",
        role: "Verified Nutrition Node",
        label: "58g Protein · 42g Carb · Collagen-Rich Bone Broth Base",
        spec: "1-Tap Macro & Sodium Adjuster Included",
        verified: true,
      },
    ],
    passportTitle: "Verified Recipe & Macro Passport",
    clearances: [
      { label: "Camera-Verified Cook Steps", value: "9:16 Step-by-Step Reel Linked", status: "elite" },
      { label: "Home Cook Replication Score", value: "318 Photo-Verified Cookbacks", status: "elite" },
      { label: "Grocery Cart Export", value: "1-Tap Instacart / Local Butcher List", status: "passed" },
      { label: "Creator Tipping & Split", value: "Auto 15% Royalty to Gen-1 Family Creator", status: "passed" },
    ],
    reelCaption: "Pulling the bone clean out after 2 hours on Hickory smoke + 3 hours in the bourbon braise.",
    reelViews: "214.0K views · 490 fan tips ⭐️",
    linkedThreadId: "thread-food-otates",
  },
  {
    id: "food-small-batch-chili-crisp",
    pillar: "chef_drops",
    pillarLabel: "Pillar 3 · Small-Batch Chef Drops & Local Catering",
    title: "Black Garlic & Smoked Habanero Crispy Chili Oil (Batch #09)",
    subtitle: "150-Jar Numbered Local Drop · Held Payment Pickup or Shipped",
    creatorBrand: "Ferment & Fire Kitchen",
    creatorHandle: "@ferment_fire",
    priceFormatted: "$22",
    depositFormatted: "$22 Protected Batch Reservation",
    authenticityLabel: "Batch Scarcity & Freshness",
    authenticityValue: "Jar #042 of 150 · Bottled 48h Ago",
    summary:
      "Lets local chefs, bakers, and pitmasters run numbered drops (plates, sauces, meal prep) using the exact same Scrlpets reservation & QR handover engine.",
    treeTitle: "Ingredient Provenance & Batch Tree",
    nodes: [
      {
        id: "aromatics",
        role: "Ferment Base",
        label: "60-Day Aged Black Garlic + Shallot Confit",
        spec: "Zero Preservatives · Cold-Pressed Avocado Oil",
        verified: true,
      },
      {
        id: "heat",
        role: "Heat Lineage",
        label: "Applewood-Smoked Red Habanero + Sichuan Tribute Peppercorn",
        spec: "Scoville 45,000 SHU · Balanced Umami",
        verified: true,
      },
      {
        id: "jar",
        role: "Batch Serialization",
        label: "QR-Serialized Glass Jar #001–#150",
        spec: "Scan Lid to View Recipe Pairings in Savor",
        verified: true,
      },
      {
        id: "handover",
        role: "Fulfillment",
        label: "Saturday Farmers Market QR Handover or Tracked Shipping",
        spec: "Protected by Synergy Held Payment",
        verified: true,
      },
    ],
    passportTitle: "Small-Batch Safety & Provenance Passport",
    clearances: [
      { label: "pH & Water Activity Test", value: "pH 4.1 · Shelf-Stable Verified", status: "passed" },
      { label: "Oil Purity Guarantee", value: "100% Pure Avocado Oil (0% Soybean)", status: "elite" },
      { label: "Batch Serialization", value: "108 / 150 Jars Claimed", status: "elite" },
      { label: "QR Pickup Protection", value: "Instant Release at Market Booth", status: "passed" },
    ],
    reelCaption: "Pouring 375°F avocado oil over smoked habanero, crushed peanuts, and 60-day black garlic.",
    reelViews: "76.3K views · 94 fan tips ⭐️",
    linkedThreadId: "thread-food-otates",
  },
];

export interface SynergyMessengerThread {
  id: string;
  vertical: "scrlpets" | "tech_gaming" | "food_recipes" | "synergy";
  verticalBadge: string;
  personaContext: SynergyPersonaId;
  counterpartyName: string;
  counterpartyHandle: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  dealCard: {
    itemTitle: string;
    itemSubtitle: string;
    priceFormatted: string;
    heldAmountFormatted: string;
    passportSummary: string;
    handoverPin: string;
    handoverQrPayload: string;
    dossierHref: string;
    status: "held_in_protection" | "ready_for_qr_handover" | "released";
  };
  messages: {
    id: string;
    sender: "them" | "me";
    text: string;
    time: string;
  }[];
}

export const SYNERGY_MESSENGER_THREADS: SynergyMessengerThread[] = [
  {
    id: "thread-scrlpets-meech",
    vertical: "scrlpets",
    verticalBadge: "🐾 Scrlpets",
    personaContext: "brand_os",
    counterpartyName: "Marcus Vance",
    counterpartyHandle: "@vance_k9",
    lastMessage: "Just pulled up for the puppy inspection—ready to scan your QR code in Messenger!",
    timestamp: "2m ago",
    unread: true,
    dealCard: {
      itemTitle: "Danu's Ark — Big Meech x Cali Pairing (Pick Male)",
      itemSubtitle: "5-Gen Certified Pedigree · COI 3.2% Low Risk · OFA/DNA Cleared",
      priceFormatted: "$2,500",
      heldAmountFormatted: "$500 Protected Reservation Deposit",
      passportSummary: "🐾 Scrlpets Animal Dossier · Vet Certificate & Weight Ledger Attached",
      handoverPin: "849204",
      handoverQrPayload: "SYNERGY-HANDOVER:SCRLPETS:ORDER-9041:PIN-849204",
      dossierHref: "/c/big-meech",
      status: "ready_for_qr_handover",
    },
    messages: [
      {
        id: "m1",
        sender: "them",
        text: "Hey Dailen, I reviewed Big Meech's 4-gen pedigree and the litter weight CSV right in the dossier.",
        time: "10:14 AM",
      },
      {
        id: "m2",
        sender: "me",
        text: "Appreciate it! The $500 Protected Deposit is locked in Held Payment Guarantee. When we meet up, we can complete the QR handover right inside this chat.",
        time: "10:16 AM",
      },
      {
        id: "m3",
        sender: "them",
        text: "Just pulled up for the puppy inspection—ready to scan your QR code in Messenger!",
        time: "Just now",
      },
    ],
  },
  {
    id: "thread-tech-rig-5090",
    vertical: "tech_gaming",
    verticalBadge: "⚡ Tech & Gaming",
    personaContext: "brand_os",
    counterpartyName: "Devon K.",
    counterpartyHandle: "@devon_frames",
    lastMessage: "3DMark Time Spy and thermal numbers look crazy. Ready to do the in-person boot check & QR release.",
    timestamp: "11m ago",
    unread: true,
    dealCard: {
      itemTitle: "Black Sheep Sovereign Workstation (RTX 5090 Dual-Loop)",
      itemSubtitle: "Parts Bottleneck 1.4% · 54°C Max Load · Serial #BS247-RIG-01",
      priceFormatted: "$3,850",
      heldAmountFormatted: "$500 Held Payment Deposit",
      passportSummary: "⚡ Tech Rig Dossier · 3DMark Top 1% & Leak-Test Passport Verified",
      handoverPin: "512098",
      handoverQrPayload: "SYNERGY-HANDOVER:TECH-STACK:ORDER-7712:PIN-512098",
      dossierHref: "/synergy?view=tech_vertical&pillar=hardware",
      status: "ready_for_qr_handover",
    },
    messages: [
      {
        id: "t1",
        sender: "them",
        text: "Tapped 'Message Builder' on the Tech vertical and it flipped me straight into Synergy Messenger with your Rig Dossier pinned at the top.",
        time: "9:40 AM",
      },
      {
        id: "t2",
        sender: "me",
        text: "That's the auto-connected Messenger flow—same Held Payment QR protection we use on Scrlpets, zero Facebook Marketplace scams.",
        time: "9:45 AM",
      },
      {
        id: "t3",
        sender: "them",
        text: "3DMark Time Spy and thermal numbers look crazy. Ready to do the in-person boot check & QR release.",
        time: "11m ago",
      },
    ],
  },
  {
    id: "thread-food-otates",
    vertical: "food_recipes",
    verticalBadge: "🍽️ Food & Recipes",
    personaContext: "personal",
    counterpartyName: "Taqueria Otates Window #1",
    counterpartyHandle: "@taqueria_otates",
    lastMessage: "Order #408 (Birria Quesataco Family Pack + Consomé) is hot on the plancha! Flash your Messenger QR at the window.",
    timestamp: "18m ago",
    unread: true,
    dealCard: {
      itemTitle: "Taqueria Otates — Jalisco Birria Quesataco Family Pack",
      itemSubtitle: "Pickup Window Slot 12:30 PM · 12-Hour Marrow Consomé Included",
      priceFormatted: "$38",
      heldAmountFormatted: "$15 No-Show Protected Pre-Order",
      passportSummary: "🍽️ Kitchen Passport · Grade-A Verified · Automatic Receipt Review Unlocked on Scan",
      handoverPin: "774120",
      handoverQrPayload: "SYNERGY-HANDOVER:FOOD-VERTICAL:ORDER-408:PIN-774120",
      dossierHref: "/synergy?view=food_vertical&pillar=local_eats",
      status: "ready_for_qr_handover",
    },
    messages: [
      {
        id: "f1",
        sender: "me",
        text: "Locked in our Birria Family Pack from your 9:16 review reel! Heading to the truck in 10 minutes.",
        time: "12:10 PM",
      },
      {
        id: "f2",
        sender: "them",
        text: "Order #408 (Birria Quesataco Family Pack + Consomé) is hot on the plancha! Flash your Messenger QR at the window.",
        time: "12:18 PM",
      },
    ],
  },
  {
    id: "thread-gaming-dualsense",
    vertical: "tech_gaming",
    verticalBadge: "🎮 Gaming & Mods",
    personaContext: "creator",
    counterpartyName: "Kobe R.",
    counterpartyHandle: "@kobe_fps",
    lastMessage: "Saw your 9:16 input-overlay reel! Grabbed the Hall-Effect DualSense + OBS pack.",
    timestamp: "1h ago",
    unread: false,
    dealCard: {
      itemTitle: "Apex Hall-Effect DualSense Edge + 120fps OBS Mod Pack",
      itemSubtitle: "0.8ms Overclock · 1.9% Circularity · Tournament Legal",
      priceFormatted: "$265",
      heldAmountFormatted: "$265 Held in Buyer Protection",
      passportSummary: "🎮 Gaming Mod Dossier · Calibration Certificate & Digital Preset Attached",
      handoverPin: "330914",
      handoverQrPayload: "SYNERGY-HANDOVER:GAMING-MOD:ORDER-6104:PIN-330914",
      dossierHref: "/synergy?view=tech_vertical&pillar=gaming",
      status: "held_in_protection",
    },
    messages: [
      {
        id: "g1",
        sender: "them",
        text: "Saw your 9:16 input-overlay reel! Grabbed the Hall-Effect DualSense + OBS pack.",
        time: "1h ago",
      },
      {
        id: "g2",
        sender: "me",
        text: "Got you! Your digital OBS/audio preset pack is already unlocked in your dossier, and the controller ships out today.",
        time: "52m ago",
      },
    ],
  },
];
