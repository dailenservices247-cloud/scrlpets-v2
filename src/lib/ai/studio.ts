export type ListingDraftInput = {
  species: string;
  rawNotes: string;
  priceCents?: number;
  sellerName?: string;
  location?: string;
};

export type ListingDraftOutput = {
  title: string;
  description: string;
  attributes: Record<string, string>;
  shippingTerms: string;
  recommendedTags: string[];
};

export type ContractDraftInput = {
  species: string;
  animalName: string;
  subtype: string; // breed, morph, caste
  sellerName: string;
  buyerName: string;
  priceCents: number;
  lagHours?: number; // Live Arrival Guarantee hours (default 2)
  healthGuaranteeDays?: number; // e.g. 365 days
};

/**
 * Deterministic, species-aware AI assistant structuring raw notes into professional listings.
 */
export function generateListingDraft(input: ListingDraftInput): ListingDraftOutput {
  const normSpecies = input.species.toLowerCase().trim();
  const priceDisplay = input.priceCents ? `$${(input.priceCents / 100).toFixed(2)}` : "Inquire for pricing";

  if (normSpecies === "insect") {
    return {
      title: input.rawNotes.slice(0, 50) || "Captive-Founded Queen Ant Colony",
      description: `Established captive-founded colony available from verified keeper. \n\nKeeper Notes: ${input.rawNotes}\n\nAll specimens are legal for interstate shipment under USDA guidelines or local state distribution. Shipped safely with water reservoir and insulated packaging.`,
      attributes: {
        Species: "Invertebrate / Insect",
        Founding: "Captive Reared / Collected",
        Price: priceDisplay,
      },
      shippingTerms: "Ships via expedited carrier in secure test tube setup with temperature buffering. Live Arrival Guarantee provided with unboxing video.",
      recommendedTags: ["#antkeeping", "#queenant", "#formicarium", "#insectcolony"],
    };
  }

  if (normSpecies === "reptile") {
    return {
      title: input.rawNotes.slice(0, 50) || "Captive-Bred Morph Specimen",
      description: `Healthy, captive-bred reptile from verified breeding program. \n\nSpecimen Profile: ${input.rawNotes}\n\nEstablished on regular feeding schedule. Lineage documentation and genetics guarantee included.`,
      attributes: {
        Species: "Reptile",
        Provenance: "Captive-Bred",
        Price: priceDisplay,
      },
      shippingTerms: "Overnight priority shipping via certified reptile carriers to nearest hub or home delivery when weather permits (40°F-90°F window).",
      recommendedTags: ["#reptiles", "#captivebred", "#morphs", "#exoticpets"],
    };
  }

  // Default / Mammal
  return {
    title: input.rawNotes.slice(0, 50) || "Verified Companion Listing",
    description: `Raised with intentional socialization and comprehensive care. \n\nCare Notes: ${input.rawNotes}\n\nIncludes complete health records, age-appropriate vaccinations, and transition support.`,
    attributes: {
      Species: input.species,
      Stewardship: "Verified Program",
      Price: priceDisplay,
    },
    shippingTerms: "Ground transport via USDA-registered pet carriers or personal handover arranged upon completed order.",
    recommendedTags: ["#scrlpets", "#verifiedbreeder", "#healthtested", "#puppy"],
  };
}

/**
 * Universal purchase agreement & Live Arrival Guarantee (LAG) contract drafter.
 */
export function generateUniversalContract(input: ContractDraftInput): string {
  const normSpecies = input.species.toLowerCase().trim();
  const priceDisplay = `$${(input.priceCents / 100).toFixed(2)}`;
  const lagHours = input.lagHours || 2;
  const healthDays = input.healthGuaranteeDays || 365;

  let guaranteeClause = "";
  if (normSpecies === "insect" || normSpecies === "reptile" || normSpecies === "fish") {
    guaranteeClause = `LIVE ARRIVAL GUARANTEE (LAG):
Seller guarantees live and healthy arrival of the specimen (${input.animalName}) provided the package is accepted on the first delivery attempt or picked up from the carrier hub within ${lagHours} hours of arrival. In the rare event of mortality or severe distress, Buyer must provide clear, unedited unboxing video proof within ${lagHours} hours of delivery to qualify for an immediate replacement or full refund under Scrlpets escrow protection.`;
  } else {
    guaranteeClause = `HEALTH WARRANTY & GENETIC GUARANTEE:
Seller guarantees that ${input.animalName} is in good health at the time of physical handover. Seller provides a ${healthDays}-day genetic health guarantee covering life-threatening congenital defects confirmed by a licensed veterinarian. Both parties agree to transfer health records via the Scrlpets Document Vault upon release.`;
  }

  return `LIVE ANIMAL PURCHASE & CUSTODY AGREEMENT
=============================================================
Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
Seller: ${input.sellerName}
Buyer: ${input.buyerName}
Animal Designation: ${input.animalName} (${input.species} · ${input.subtype})
Agreed Purchase Amount: ${priceDisplay}

TERMS AND CONDITIONS:
1. IDENTIFICATION & HEALTH PASSING:
Seller warrants that the animal corresponds directly to the identity, records, and photographs recorded in the Scrlpets profile.

2. ${guaranteeClause}

3. DISPUTE RESOLUTION:
Any claims under this agreement shall be submitted through the Scrlpets Escrow Arbitration procedure, governed by the immutable records stored in the platform's counterparty dossier.

Seller Signature: _______________________ Date: _________
Buyer Signature:  _______________________ Date: _________`;
}

/**
 * Prepares species-tailored symptom observation checklist for vet visits.
 */
export function generateVetPrepChecklist(species: string, observations: string): string[] {
  const normSpecies = species.toLowerCase().trim();
  const base = [
    `Primary Observation: "${observations}"`,
    "Duration of symptoms and changes in water consumption",
    "Fecal and urinary output consistency and frequency",
  ];

  if (normSpecies === "reptile") {
    return [
      ...base,
      "Basking spot and ambient temperature readings (cool/hot side)",
      "UVB bulb brand, age, and photoperiod hours",
      "Recent shedding cycle and humidity levels",
      "Calcium and multivitamin supplementation frequency",
    ];
  }

  if (normSpecies === "insect") {
    return [
      ...base,
      "Test tube or formicarium moisture gradient status",
      "Worker mortality count and queen egg-laying rate",
      "Sugar and protein source rotation",
    ];
  }

  return [
    ...base,
    "Dietary appetite and brand of food currently fed",
    "Vaccination dates and last administered dewormer",
    "Energy levels, mobility, and respiration rate",
  ];
}
