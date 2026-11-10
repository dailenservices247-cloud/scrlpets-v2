/**
 * Comprehensive Statutory and Taxonomic Framework for Companion Animal & Exotic Pet Legality
 *
 * Implements the 3-tiered regulatory hierarchy (Federal Baseline -> State Police Power -> Municipal Code)
 * and the 6 functional legal tiers across domestic, exotic, livestock, native furbearer, and restricted fauna.
 *
 * Primary Legal Authorities:
 * - Federal:
 *   - Lacey Act Injurious Wildlife (18 U.S.C. § 42; 50 C.F.R. Part 16)
 *   - Big Cat Public Safety Act of 2022 (BCPSA, Pub. L. 117-243, 16 U.S.C. §§ 3371-3378; 50 C.F.R. Part 14 Subpart K)
 *   - Migratory Bird Treaty Act (MBTA, 16 U.S.C. §§ 703-712)
 *   - Endangered Species Act (ESA, 16 U.S.C. §§ 1531-1544)
 * - State (Model: Ohio Revised Code & 50-State Spectrum):
 *   - ORC Chapter 935 (Dangerous Wild Animals & Restricted Snakes Act)
 *   - ORC Chapters 1531 & 1533 (ODNR Division of Wildlife Native Fauna & Propagation)
 *   - ORC § 901.70 (Domesticated Livestock)
 * - Municipal (Model: Toledo Municipal Code & Lucas County):
 *   - TMC Chapter 505 (Animals and Fowl; Pit bull legality under TMC § 505.03/ORC § 955.16)
 *   - TMC § 1705.11 (Backyard Hens: max 6, 0 roosters, 25ft dwelling setback, 5ft side setback)
 *   - TMC § 1705.05 / TLCHD SOP EH-033 (Urban Livestock & Waterfowl Permits)
 */

export type RegulatoryTier = 1 | 2 | 3 | 4 | 5 | 6;

export type TierCategory =
  | "domestic_companion"
  | "broadly_legal_exotic"
  | "livestock_equine_poultry"
  | "permit_native_wildlife"
  | "state_restricted_dwa"
  | "federally_prohibited_injurious";

export type BreederVocabulary = {
  groupName: string; // e.g. "My Pack", "My Stable", "My Clowder", "My Aviary"
  roleBadge: string; // e.g. "Kennel", "Stable", "Cattery", "Aviary", "Herpetarium"
  youngGroup: string; // e.g. "litter", "clutch", "spawn", "brood", "foal", "piglet", "kid", "lamb", "cria", "kit", "hoglet", "joey", "infant", "group"
  taxonomyLabel: string; // e.g. "Breed", "Morph / Locality", "Mutation / Variety", "Bloodline / Strain"
  youngTerm: string; // e.g. "Puppy", "Kitten", "Foal", "Piglet", "Kid", "Lamb", "Cria", "Kit", "Hoglet", "Joey", "Hatchling", "Fry", "Infant"
  damTerm: string; // e.g. "Dam", "Mare", "Sow", "Doe", "Ewe", "Hen", "Queen", "Female"
  sireTerm: string; // e.g. "Sire", "Stallion", "Boar", "Buck", "Ram", "Rooster", "Tom", "Male"
};

export type SpeciesLegalProfile = {
  id: string;
  name: string;
  scientificTaxa: string;
  tier: RegulatoryTier;
  category: TierCategory;
  primaryAuthority: string;
  statutoryCitation: string;
  complianceMechanism: string;
  commercialListingAllowed: boolean;
  breedingPermitted: boolean;
  prohibitionNotice?: string;
  complianceDisclaimer?: string;
  vocabulary: BreederVocabulary;
  aliases: string[];
};

export const REGULATORY_TIERS_META: Record<
  RegulatoryTier,
  {
    tier: RegulatoryTier;
    title: string;
    description: string;
    primaryGoverningAuthority: string;
    complianceMechanism: string;
    statusBadgeColor: string;
  }
> = {
  1: {
    tier: 1,
    title: "Tier 1: Universally Legal Domestic Companions",
    description:
      "Universally recognized domestic companion animals legal across all 50 U.S. states, subject only to local licensing, rabies vaccination, and standard cruelty statutes.",
    primaryGoverningAuthority: "Municipal Animal Control & State Rabies / Cruelty Statutes",
    complianceMechanism: "No state exotic permit; local dog/cat licensing & vaccination",
    statusBadgeColor: "border-primary/40 bg-primary/10 text-brand-link",
  },
  2: {
    tier: 2,
    title: "Tier 2: Broadly Legal Unregulated Exotics (State-Variable)",
    description:
      "Non-native exotic pets legal without a dangerous wild animal permit in enumerated 'black-list' and 'no-permit' jurisdictions (e.g., OH, NC, WI), with selective prohibitions in strict agricultural states (e.g., CA, HI).",
    primaryGoverningAuthority: "State Departments of Agriculture / Wildlife & Municipal Codes",
    complianceMechanism: "Legal by right where unenumerated; out-of-state health certificates",
    statusBadgeColor: "border-secondary/40 bg-secondary/10 text-secondary-foreground",
  },
  3: {
    tier: 3,
    title: "Tier 3: Domestic Livestock, Equines & Poultry",
    description:
      "Agricultural animals, equines, and domestic fowl exempt from state wild animal bans; legal by right in agricultural zones and governed by municipal setback/variance rules in urban areas.",
    primaryGoverningAuthority: "State Agricultural Codes (ORC § 901.70) & Municipal Health / Zoning Codes (TMC §§ 1705.05, 1705.11)",
    complianceMechanism: "Exempt from DWA bans; urban lot setbacks, hen caps (e.g. 6 in Toledo), and health department livestock permits",
    statusBadgeColor: "border-accent/40 bg-accent/10 text-accent-foreground",
  },
  4: {
    tier: 4,
    title: "Tier 4: Permit-Conditional Native Wildlife & Furbearers",
    description:
      "Indigenous North American mammals and reptiles; wild capture for pets is generally barred, while legally acquired captive-bred specimens require state propagation licenses and transponder tagging.",
    primaryGoverningAuthority: "State Departments of Natural Resources / Fish & Game (e.g. ODNR ORC Chapters 1531 & 1533)",
    complianceMechanism: "Captive-bred propagation license, out-of-state import permit, and 134.2/135 kHz PIT transponder tags",
    statusBadgeColor: "border-amber-600/40 bg-amber-600/10 text-amber-500",
  },
  5: {
    tier: 5,
    title: "Tier 5: State-Restricted 'Dangerous Wild Animals' & Venomous Reptiles",
    description:
      "Restricted megafauna, dangerous constrictors (≥12 ft), venomous reptiles, and registered small primates. Private pet ownership is strictly regulated or grandfathered with mandatory caging and insurance.",
    primaryGoverningAuthority: "State DWA Statutes (ORC Chapter 935) & State Fish/Wildlife Commissions",
    complianceMechanism: "Grandfathered registration, mandatory microchipping, or ODA Restricted Snake / Small Primate permits",
    statusBadgeColor: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  6: {
    tier: 6,
    title: "Tier 6: Federally Prohibited & Injurious Species",
    description:
      "Apex predators and high-risk invasive wildlife prohibited nationwide from new private acquisition, commercial breeding, and interstate pet transport under federal law.",
    primaryGoverningAuthority: "USFWS (Big Cat Public Safety Act 16 U.S.C. §§ 3371-3378; Lacey Act 18 U.S.C. § 42; 50 C.F.R. Parts 14 & 16)",
    complianceMechanism: "Federal ban on private breeding and commercial trade; scientific/zoological exhibition only",
    statusBadgeColor: "border-destructive bg-destructive/20 text-destructive font-bold",
  },
};

/**
 * Authoritative Species Catalog mapping common companion and exotic taxa
 * to their statutory tiers, compliance mechanisms, and breeder vocabulary.
 */
export const SPECIES_CATALOG: SpeciesLegalProfile[] = [
  // =========================================================================
  // TIER 1: Universally Legal Domestic Companions
  // =========================================================================
  {
    id: "dog",
    name: "Domestic Dog",
    scientificTaxa: "Canis lupus familiaris",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Animal Control & State Dog Codes (ORC Chapter 955, TMC § 505.03)",
    statutoryCitation: "ORC §§ 955.01-955.16; TMC § 505.03 (Pit bulls legal by right since 2010 repeal)",
    complianceMechanism: "Annual municipal registration & collar tag, mandatory rabies immunization",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Pack",
      roleBadge: "Kennel",
      youngGroup: "litter",
      taxonomyLabel: "Breed",
      youngTerm: "Puppy",
      damTerm: "Dam",
      sireTerm: "Sire",
    },
    aliases: ["canine", "puppy", "hound", "pit bull", "presa", "corso", "bulldog", "shepherd", "retriever"],
  },
  {
    id: "cat",
    name: "Domestic Cat",
    scientificTaxa: "Felis catus",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Animal Control (TMC § 505.16) & State Rabies Statutes",
    statutoryCitation: "TMC §§ 505.16-505.18; ORC Chapter 955",
    complianceMechanism: "Municipal registration tag for cats over 6 months; rabies vaccination",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Clowder",
      roleBadge: "Cattery",
      youngGroup: "litter",
      taxonomyLabel: "Breed",
      youngTerm: "Kitten",
      damTerm: "Queen",
      sireTerm: "Tom",
    },
    aliases: ["feline", "kitten", "domestic cat", "shorthair", "persian", "siamese", "maine coon"],
  },
  {
    id: "rabbit",
    name: "Domestic Rabbit",
    scientificTaxa: "Oryctolagus cuniculus domesticus",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Code & Humane Cruelty Statutes",
    statutoryCitation: "Exempt from DWA; non-wild domestic lagomorph",
    complianceMechanism: "No state permit required; standard municipal companion pet limits",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Warren",
      roleBadge: "Rabbitry",
      youngGroup: "litter",
      taxonomyLabel: "Breed",
      youngTerm: "Kit",
      damTerm: "Doe",
      sireTerm: "Buck",
    },
    aliases: ["bunny", "lagomorph", "holland lop", "netherland dwarf", "flemish giant"],
  },
  {
    id: "guinea_pig",
    name: "Guinea Pig (Cavy)",
    scientificTaxa: "Cavia porcellus",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Animal Control",
    statutoryCitation: "Universally legal domestic rodent",
    complianceMechanism: "No permit required",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Herd",
      roleBadge: "Cavy Breeder",
      youngGroup: "litter",
      taxonomyLabel: "Breed & Coat",
      youngTerm: "Pup",
      damTerm: "Sow",
      sireTerm: "Boar",
    },
    aliases: ["cavy", "guinea pig"],
  },
  {
    id: "hamster",
    name: "Hamster",
    scientificTaxa: "Cricetinae (Mesocricetus auratus, Phodopus spp.)",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Animal Control (selectively prohibited in HI)",
    statutoryCitation: "Universally legal domestic rodent in contiguous 48 states",
    complianceMechanism: "No permit required",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Colony",
      roleBadge: "Pocket Pet Breeder",
      youngGroup: "litter",
      taxonomyLabel: "Species & Variety",
      youngTerm: "Pup",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["syrian hamster", "dwarf hamster", "roborovski"],
  },
  {
    id: "chinchilla",
    name: "Domestic Chinchilla",
    scientificTaxa: "Chinchilla lanigera",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Code & State Agriculture",
    statutoryCitation: "Domestic captive-bred rodent; exempt from DWA bans",
    complianceMechanism: "No permit required",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Herd",
      roleBadge: "Chinchilla Breeder",
      youngGroup: "litter",
      taxonomyLabel: "Color Mutation",
      youngTerm: "Kit",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["chin", "chinchilla"],
  },
  {
    id: "pigeon",
    name: "Racing & Fancy Pigeon / Dove",
    scientificTaxa: "Columba livia domestica / Columbidae",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "Municipal Zoning & State Game Codes",
    statutoryCitation: "Exempt from Migratory Bird Treaty Act (MBTA); non-native domestic columbid",
    complianceMechanism: "Loft setback compliance in urban areas; no federal permit",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Loft",
      roleBadge: "Loftmaster",
      youngGroup: "clutch",
      taxonomyLabel: "Breed & Strain",
      youngTerm: "Squab",
      damTerm: "Hen",
      sireTerm: "Cock",
    },
    aliases: ["dove", "homing pigeon", "roller pigeon", "fantail"],
  },
  {
    id: "caged_bird",
    name: "Canary, Finch & Cockatiel",
    scientificTaxa: "Serinus canaria, Taeniopygia guttata, Nymphicus hollandicus",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "USFWS & State Wildlife (Exempt from MBTA)",
    statutoryCitation: "50 C.F.R. § 10.13 exemption (non-migratory, non-native captive cage birds)",
    complianceMechanism: "No state or federal permit required",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Aviary",
      roleBadge: "Aviary",
      youngGroup: "clutch",
      taxonomyLabel: "Mutation & Variety",
      youngTerm: "Chick",
      damTerm: "Hen",
      sireTerm: "Cock",
    },
    aliases: ["canary", "finch", "budgie", "budgerigar", "cockatiel", "parakeet"],
  },
  {
    id: "aquarium_fish",
    name: "Aquarium Fish & Corals",
    scientificTaxa: "Actinopterygii / Anthozoa (Non-Injurious)",
    tier: 1,
    category: "domestic_companion",
    primaryAuthority: "State Fish & Game / USFWS (Non-Injurious Species)",
    statutoryCitation: "Exempt from Lacey Act Injurious listings (excludes walking catfish, snakeheads, Asian carp)",
    complianceMechanism: "No permit required for captive-bred freshwater or marine ornamental fish",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Aquarium",
      roleBadge: "Aquatic Breeder",
      youngGroup: "spawn",
      taxonomyLabel: "Strain & Variety",
      youngTerm: "Fry",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["cichlid", "discus", "guppy", "betta", "coral", "angelfish", "marine fish"],
  },

  // =========================================================================
  // TIER 2: Broadly Legal Unregulated Exotics (State-Variable)
  // =========================================================================
  {
    id: "ferret",
    name: "Domesticated Ferret",
    scientificTaxa: "Mustela putorius furo",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Departments of Agriculture (Prohibited in CA and HI; legal in 48 states)",
    statutoryCitation: "Omitted from ORC § 935.01 DWA list; prohibited under CA Fish & Game Code § 2118",
    complianceMechanism: "Legal without permit in permissive states; veterinary health certificate for interstate transit",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "Notice: Ferrets are legal across 48 states, but strictly prohibited by state statute in California and Hawaii.",
    vocabulary: {
      groupName: "My Business",
      roleBadge: "Ferretry",
      youngGroup: "kit",
      taxonomyLabel: "Color & Pattern",
      youngTerm: "Kit",
      damTerm: "Jill",
      sireTerm: "Hob",
    },
    aliases: ["mustelid", "black-footed ferret hybrid"],
  },
  {
    id: "hedgehog",
    name: "African Pygmy Hedgehog",
    scientificTaxa: "Atelerix albiventris",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Departments of Agriculture (Banned in CA, GA, HI, NYC; legal in OH, TX, FL)",
    statutoryCitation: "Omitted from ORC § 935.01 DWA list; legal by right in Ohio and most states",
    complianceMechanism: "USDA Class A breeding license required for commercial sales exceeding statutory hobby thresholds",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "Check state laws: hedgehogs are legal in most states including Ohio, but prohibited in California, Georgia, Hawaii, and NYC.",
    vocabulary: {
      groupName: "My Array",
      roleBadge: "Hedgehog Breeder",
      youngGroup: "hoglet",
      taxonomyLabel: "Color & Morph",
      youngTerm: "Hoglet",
      damTerm: "Sow",
      sireTerm: "Boar",
    },
    aliases: ["four-toed hedgehog", "pygmy hedgehog"],
  },
  {
    id: "sugar_glider",
    name: "Sugar Glider",
    scientificTaxa: "Petaurus breviceps",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Wildlife & USDA APHIS (Banned in CA, AK, HI, NYC; legal in OH)",
    statutoryCitation: "Omitted from ORC § 935.01; non-DWA marsupial",
    complianceMechanism: "Hobby breeding permitted; USDA breeder license required if maintaining >4 breeding females",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Mob",
      roleBadge: "Marsupial Breeder",
      youngGroup: "joey",
      taxonomyLabel: "Color Morph & Lineage",
      youngTerm: "Joey",
      damTerm: "Doe",
      sireTerm: "Buck",
    },
    aliases: ["glider", "sugar bear", "petaurus"],
  },
  {
    id: "savannah_cat",
    name: "Savannah Cat (F1-F5 Serval Hybrid)",
    scientificTaxa: "Leptailurus serval x Felis catus",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Departments of Agriculture & Wildlife (ORC § 935.01(C)(7)(e) exemption)",
    statutoryCitation: "ORC § 935.01(C)(7)(e) ('Savannah cats are explicitly excluded from the dangerous wild animal definition')",
    complianceMechanism: "Completely legal without permit in Ohio; check municipal generation limits in certain states",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Clowder",
      roleBadge: "Cattery",
      youngGroup: "litter",
      taxonomyLabel: "Generation (F1-F5) & Pattern",
      youngTerm: "Kitten",
      damTerm: "Queen",
      sireTerm: "Tom",
    },
    aliases: ["serval hybrid", "savannah kitten", "f1 savannah", "f2 savannah"],
  },
  {
    id: "bengal_cat",
    name: "Bengal Cat",
    scientificTaxa: "Prionailurus bengalensis x Felis catus",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Departments of Agriculture & Municipal Codes",
    statutoryCitation: "Recognized domestic felid hybrid; omitted from ORC § 935.01 DWA list",
    complianceMechanism: "No exotic permit required; standard cat licensing",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Clowder",
      roleBadge: "Cattery",
      youngGroup: "litter",
      taxonomyLabel: "Generation & Rosette Pattern",
      youngTerm: "Kitten",
      damTerm: "Queen",
      sireTerm: "Tom",
    },
    aliases: ["asian leopard cat hybrid", "bengal kitten"],
  },
  {
    id: "wolfdog",
    name: "Wolf-Dog Hybrid",
    scientificTaxa: "Canis lupus x Canis lupus familiaris",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Wildlife & Agriculture (ORC § 935.01(C)(2) explicit exemption)",
    statutoryCitation: "ORC § 935.01(C)(2) ('Gray wolf hybrids are explicitly excluded from the definition of dangerous wild animal')",
    complianceMechanism: "Legal at state level in Ohio; check municipal ordinances for localized breed/hybrid restrictions",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "Statutory note: Gray wolf hybrids are exempt from state DWA bans in Ohio (ORC § 935.01(C)(2)), but verify local county/city zoning.",
    vocabulary: {
      groupName: "My Pack",
      roleBadge: "Kennel & Pack",
      youngGroup: "litter",
      taxonomyLabel: "Content % & Lineage",
      youngTerm: "Puppy",
      damTerm: "Dam",
      sireTerm: "Sire",
    },
    aliases: ["wolf dog", "wolf hybrid", "timber wolf cross"],
  },
  {
    id: "dwarf_caiman",
    name: "Cuvier's / Schneider's Dwarf Caiman",
    scientificTaxa: "Paleosuchus palpebrosus / Paleosuchus trigonatus",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Departments of Agriculture (ORC § 935.01(C)(17) explicit exemption)",
    statutoryCitation: "ORC § 935.01(C)(17) ('Dwarf caimans of the genus Paleosuchus are explicitly excluded from the crocodilian ban')",
    complianceMechanism: "Legal without an ODA dangerous wild animal permit in Ohio; must be physically confined to owner property (TMC § 505.20(c))",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Vivarium",
      roleBadge: "Crocodilian Breeder",
      youngGroup: "clutch",
      taxonomyLabel: "Species & Locality",
      youngTerm: "Hatchling",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["cuvier's dwarf caiman", "paleosuchus", "smooth-fronted caiman"],
  },
  {
    id: "ball_python",
    name: "Ball Python & Non-Restricted Boids",
    scientificTaxa: "Python regius / Boa constrictor (Non-Giant / <12ft)",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Departments of Agriculture & Wildlife",
    statutoryCitation: "ORC § 935.01(L) (Ball pythons and non-restricted constrictors under 12 feet require no state permit)",
    complianceMechanism: "Legal without permit; non-venomous, docile captive-bred constrictor",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Herpetarium",
      roleBadge: "Herpetarium",
      youngGroup: "clutch",
      taxonomyLabel: "Morph / Locality",
      youngTerm: "Hatchling",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["royal python", "ball python morph", "boa constrictor imperator", "corn snake", "kingsnake"],
  },
  {
    id: "bearded_dragon",
    name: "Bearded Dragon & Leopard Gecko",
    scientificTaxa: "Pogona vitticeps / Eublepharis macularius",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "State Wildlife Commissions",
    statutoryCitation: "Omitted from ORC § 935.01 DWA list; non-venomous captive-bred saurians",
    complianceMechanism: "Universally legal companion reptiles across all contiguous states",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Herpetarium",
      roleBadge: "Herpetarium",
      youngGroup: "clutch",
      taxonomyLabel: "Morph / Locality",
      youngTerm: "Hatchling",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["gecko", "skink", "crested gecko", "chameleon", "monitor", "tegu"],
  },
  {
    id: "psittacine_parrot",
    name: "Parrots, Macaws & Cockatoos",
    scientificTaxa: "Psittaciformes (Ara, Cacatua, Amazona, Psittacus)",
    tier: 2,
    category: "broadly_legal_exotic",
    primaryAuthority: "USFWS (50 C.F.R. § 14.61) & Wild Bird Conservation Act (WBCA)",
    statutoryCitation: "16 U.S.C. §§ 4901-4916 (WBCA protects wild populations; captive-bred specimens legal nationwide)",
    complianceMechanism: "Captive-bred closed-band identification; CITES documentation for international commercial export",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Aviary",
      roleBadge: "Aviary",
      youngGroup: "clutch",
      taxonomyLabel: "Mutation & Species",
      youngTerm: "Chick",
      damTerm: "Hen",
      sireTerm: "Cock",
    },
    aliases: ["macaw", "cockatoo", "african grey", "amazon parrot", "conure", "lovebird"],
  },

  // =========================================================================
  // TIER 3: Domestic Livestock, Equines & Poultry
  // =========================================================================
  {
    id: "horse",
    name: "Horse, Pony, Mule & Donkey",
    scientificTaxa: "Equus caballus / Equus asinus",
    tier: 3,
    category: "livestock_equine_poultry",
    primaryAuthority: "State Agricultural Codes (ORC § 901.70) & Municipal Zoning",
    statutoryCitation: "ORC § 901.70 (Agricultural livestock exemption from DWA)",
    complianceMechanism: "Equine Infectious Anemia (Coggins) test for transport; agricultural acreage zoning",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Stable",
      roleBadge: "Stable & Equestrian Center",
      youngGroup: "foal",
      taxonomyLabel: "Breed & Bloodline",
      youngTerm: "Foal",
      damTerm: "Mare",
      sireTerm: "Stallion",
    },
    aliases: ["equine", "pony", "donkey", "mule", "thoroughbred", "quarter horse", "friesian", "arabian"],
  },
  {
    id: "chicken",
    name: "Domestic Chicken (Urban Hens & Poultry)",
    scientificTaxa: "Gallus gallus domesticus",
    tier: 3,
    category: "livestock_equine_poultry",
    primaryAuthority: "Municipal Health & Zoning Codes (e.g. TMC § 1705.11 Ord. 290-15)",
    statutoryCitation: "TMC § 1705.11 (Max 6 hens by right, 0 roosters, 25ft neighbor setback, 5ft side lot line)",
    complianceMechanism: "No permit/fee for up to 6 hens meeting setbacks; $75 annual TLCHD variance for >6 hens or encroached setbacks",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "Municipal ordinance: in Toledo (TMC § 1705.11), up to 6 hens are permitted by right. Roosters are prohibited inside city limits.",
    vocabulary: {
      groupName: "My Flock",
      roleBadge: "Aviary & Flock",
      youngGroup: "clutch",
      taxonomyLabel: "Breed & Variety",
      youngTerm: "Chick",
      damTerm: "Hen",
      sireTerm: "Rooster",
    },
    aliases: ["hen", "poultry", "rooster", "silkie", "orpington", "bantam"],
  },
  {
    id: "goat",
    name: "Domestic Goat & Sheep",
    scientificTaxa: "Capra hircus / Ovis aries",
    tier: 3,
    category: "livestock_equine_poultry",
    primaryAuthority: "State Agriculture & Municipal Sanitary Code (TMC § 1705.05)",
    statutoryCitation: "ORC § 901.70; TMC § 1705.05; TLCHD SOP EH-033",
    complianceMechanism: "USDA Scrapie flock tagging; written Livestock Permit from Health Commissioner in Toledo limits",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Herd",
      roleBadge: "Dairy & Herd",
      youngGroup: "kid",
      taxonomyLabel: "Breed & Dairy Class",
      youngTerm: "Kid",
      damTerm: "Doe",
      sireTerm: "Buck",
    },
    aliases: ["sheep", "lamb", "nigerian dwarf", "nubian", "boer", "dairy goat"],
  },
  {
    id: "pig",
    name: "Potbellied Pig & Swine",
    scientificTaxa: "Sus domesticus",
    tier: 3,
    category: "livestock_equine_poultry",
    primaryAuthority: "State Agriculture & Municipal Sanitary Code (TMC § 1705.05)",
    statutoryCitation: "TMC § 1705.05; TLCHD SOP EH-033 Livestock Permit",
    complianceMechanism: "TLCHD inspection for rodent harborage, odor control, and escape-proof fencing in Toledo",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Sounder",
      roleBadge: "Piggery",
      youngGroup: "piglet",
      taxonomyLabel: "Breed & Conformation",
      youngTerm: "Piglet",
      damTerm: "Sow",
      sireTerm: "Boar",
    },
    aliases: ["swine", "potbelly", "juliana", "kune kune", "mini pig"],
  },
  {
    id: "alpaca",
    name: "Alpaca, Llama & Camel",
    scientificTaxa: "Vicugna pacos / Lama glama / Camelus spp.",
    tier: 3,
    category: "livestock_equine_poultry",
    primaryAuthority: "State Department of Agriculture (ORC § 901.70)",
    statutoryCitation: "ORC § 901.70 (Camelids classified as domestic livestock, exempt from DWA)",
    complianceMechanism: "Standard livestock interstate health certificates (CVI); no dangerous wild animal permit required",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Herd",
      roleBadge: "Ranch & Fiber Herd",
      youngGroup: "cria",
      taxonomyLabel: "Fleece & Bloodline",
      youngTerm: "Cria",
      damTerm: "Dam",
      sireTerm: "Sire",
    },
    aliases: ["llama", "camelid", "camel", "dromedary", "bactrian"],
  },
  {
    id: "duck",
    name: "Domestic Duck & Waterfowl",
    scientificTaxa: "Anas platyrhynchos domesticus / Anser anser domesticus",
    tier: 3,
    category: "livestock_equine_poultry",
    primaryAuthority: "Municipal Health Code (TMC § 1705.05) & State Agriculture",
    statutoryCitation: "Exempt from MBTA (domestic strains); TLCHD SOP EH-033 written permit in city limits",
    complianceMechanism: "Free one-time TLCHD Livestock Permit following on-site sanitary inspection in Toledo",
    commercialListingAllowed: true,
    breedingPermitted: true,
    vocabulary: {
      groupName: "My Raft",
      roleBadge: "Waterfowl Breeder",
      youngGroup: "clutch",
      taxonomyLabel: "Breed & Variety",
      youngTerm: "Duckling",
      damTerm: "Duck",
      sireTerm: "Drake",
    },
    aliases: ["goose", "geese", "waterfowl", "call duck", "pekin", "muscovy"],
  },

  // =========================================================================
  // TIER 4: Permit-Conditional Native Wildlife & Furbearers
  // =========================================================================
  {
    id: "native_fox",
    name: "Red & Gray Fox (Captive-Bred)",
    scientificTaxa: "Vulpes vulpes / Urocyon cinereoargenteus",
    tier: 4,
    category: "permit_native_wildlife",
    primaryAuthority: "State Wildlife Agencies (e.g. ODNR Division of Wildlife ORC § 1533.71)",
    statutoryCitation: "ORC §§ 1531.01(W), 1533.71 (Noncommercial Wild Animal Propagation License)",
    complianceMechanism: "Captive-bred provenance documentation, one-time ODNR importation permit, escape-proof housing",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "State permit required: Wild capture is illegal. Ohio residents require an ODNR Noncommercial Propagation License (ORC § 1533.71) for captive-bred foxes.",
    vocabulary: {
      groupName: "My Skulk",
      roleBadge: "Wildlife Propagation Facility",
      youngGroup: "kit",
      taxonomyLabel: "Color Mutation & Lineage",
      youngTerm: "Kit",
      damTerm: "Vixen",
      sireTerm: "Dog Fox",
    },
    aliases: ["red fox", "silver fox", "gray fox", "fur-bearing animal"],
  },
  {
    id: "native_herp",
    name: "Native Herpetofauna (Wild-Captured / Captive-Bred)",
    scientificTaxa: "Sternotherus odoratus, Chrysemys picta, etc.",
    tier: 4,
    category: "permit_native_wildlife",
    primaryAuthority: "State Division of Wildlife (ODNR)",
    statutoryCitation: "ORC § 1533.71; ODNR Wild-Captured Native Reptiles & Amphibians List",
    complianceMechanism: "Limit 4 individuals; mandatory passive integrated transponder (PIT) tag (134.2/135 kHz) read by AVID Mini Tracker",
    commercialListingAllowed: false,
    breedingPermitted: false,
    complianceDisclaimer: "Statutory notice: Wild-captured native herpetofauna (max 4 in OH) cannot be sold commercially and require an implanted PIT transponder tag.",
    vocabulary: {
      groupName: "My Herpetarium",
      roleBadge: "Native Herp Keeper",
      youngGroup: "clutch",
      taxonomyLabel: "Species & Locality",
      youngTerm: "Hatchling",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["painted turtle", "musk turtle", "native frog", "box turtle"],
  },

  // =========================================================================
  // TIER 5: State-Restricted "Dangerous Wild Animals" & Venomous Reptiles
  // =========================================================================
  {
    id: "registered_primate",
    name: "Registered Small Primates (Marmosets, Capuchins, Lemurs)",
    scientificTaxa: "Callitrichidae, Cebus spp., Lemuroidea, Saimiri spp.",
    tier: 5,
    category: "state_restricted_dwa",
    primaryAuthority: "State Department of Agriculture (ORC § 935.041 Registration Pathway)",
    statutoryCitation: "ORC § 935.041 (Registration of marmosets, squirrel monkeys, capuchins, and lemurs with Director of Agriculture)",
    complianceMechanism: "Director of Agriculture registration, microchipping, escape-proof caging; exempt from 1-acre & liability insurance mandates",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "State registration required: Small primates (marmosets, squirrel monkeys, capuchins, lemurs) require registration under ORC § 935.041.",
    vocabulary: {
      groupName: "My Troop",
      roleBadge: "Primate Sanctuary & Keeper",
      youngGroup: "infant",
      taxonomyLabel: "Species & Lineage",
      youngTerm: "Infant",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["marmoset", "capuchin", "lemur", "squirrel monkey", "finger monkey"],
  },
  {
    id: "restricted_snake",
    name: "Restricted Giant Constrictor (≥12 ft) & Venomous Snakes",
    scientificTaxa: "Python reticulatus (≥12ft), Python bivittatus (≥12ft), Viperidae, Elapidae",
    tier: 5,
    category: "state_restricted_dwa",
    primaryAuthority: "State Department of Agriculture (ORC § 935.01(L) Restricted Snake Permit)",
    statutoryCitation: "ORC §§ 935.08, 935.10 (Restricted Snake Permit required within 120 days of acquisition); TMC § 505.22",
    complianceMechanism: "ODA Restricted Snake Permit, locked escape-proof room, antivenom supply verification, liability insurance",
    commercialListingAllowed: true,
    breedingPermitted: true,
    complianceDisclaimer: "Statutory permit trigger: Constrictors measuring 12 feet or longer and all venomous snakes require an ODA Restricted Snake Permit (ORC § 935.08).",
    vocabulary: {
      groupName: "My Herpetarium",
      roleBadge: "Specialist Herpetarium",
      youngGroup: "clutch",
      taxonomyLabel: "Morph / Locality",
      youngTerm: "Hatchling",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["venomous snake", "giant python", "reticulated python 12ft", "burmese python 12ft", "viper", "cobra"],
  },

  // =========================================================================
  // TIER 6: Federally Prohibited & Injurious Species
  // =========================================================================
  {
    id: "big_cat",
    name: "Big Cats (Lions, Tigers, Leopards, Jaguars, Cougars & Hybrids)",
    scientificTaxa: "Panthera leo, P. tigris, P. pardus, P. onca, Uncia uncia, Neofelis nebulosa, Acinonyx jubatus, Puma concolor",
    tier: 6,
    category: "federally_prohibited_injurious",
    primaryAuthority: "USFWS (Big Cat Public Safety Act of 2022, 16 U.S.C. §§ 3371-3378; 50 C.F.R. Part 14 Subpart K)",
    statutoryCitation: "16 U.S.C. § 3372(e) (Federal crime to breed, possess, sell, or transport live prohibited wildlife species)",
    complianceMechanism: "Strict federal prohibition on private ownership and commercial listing nationwide (USDA Class C accredited zoos only)",
    commercialListingAllowed: false,
    breedingPermitted: false,
    prohibitionNotice:
      "FEDERAL PROHIBITION NOTICE: Under the Big Cat Public Safety Act (16 U.S.C. § 3372(e)), private pet acquisition, breeding, commercial listing, and trade of big cats (lions, tigers, leopards, snow leopards, clouded leopards, jaguars, cheetahs, cougars, or any hybrid thereof) are strictly illegal nationwide. Violations are subject to federal criminal penalties and mandatory asset forfeiture under 16 U.S.C. §§ 3373-3374.",
    vocabulary: {
      groupName: "Accredited Wildlife Sanctuary",
      roleBadge: "USDA Class C Sanctuary",
      youngGroup: "litter",
      taxonomyLabel: "Subspecies & Lineage",
      youngTerm: "Cub",
      damTerm: "Dam",
      sireTerm: "Sire",
    },
    aliases: ["lion", "tiger", "leopard", "snow leopard", "clouded leopard", "jaguar", "cheetah", "cougar", "mountain lion", "panther", "liger", "tigon"],
  },
  {
    id: "injurious_wildlife",
    name: "Lacey Act Injurious Wildlife (Mongooses, Flying Foxes, Snakeheads, Bsal Salamanders)",
    scientificTaxa: "50 C.F.R. Part 16 (Pteropus, Herpestes, Channa, Clariidae, 236 Bsal Salamanders)",
    tier: 6,
    category: "federally_prohibited_injurious",
    primaryAuthority: "USFWS (Lacey Act 18 U.S.C. § 42; 50 C.F.R. Part 16)",
    statutoryCitation: "18 U.S.C. § 42; 50 C.F.R. §§ 16.11-16.15",
    complianceMechanism: "Federal ban on importation and interstate shipment without scientific/zoological permits",
    commercialListingAllowed: false,
    breedingPermitted: false,
    prohibitionNotice:
      "FEDERAL INJURIOUS WILDLIFE NOTICE: Under 18 U.S.C. § 42 and 50 C.F.R. Part 16, importation and interstate movement of listed injurious species (including flying foxes, mongooses, walking catfishes, snakeheads, and 236 Bsal-vector salamanders) are federal crimes punishable by imprisonment and fines.",
    vocabulary: {
      groupName: "Research Institution",
      roleBadge: "Permitted Facility",
      youngGroup: "group",
      taxonomyLabel: "Taxonomic Species",
      youngTerm: "Young",
      damTerm: "Female",
      sireTerm: "Male",
    },
    aliases: ["mongoose", "fruit bat", "flying fox", "snakehead", "walking catfish", "multimammate rat", "raccoon dog", "dhole"],
  },
];

/**
 * Resolve a species string against the statutory catalog.
 * Performs normalization, alias lookup, and prefix matching.
 */
export function lookupSpeciesProfile(rawSpecies: string | null | undefined): SpeciesLegalProfile | null {
  if (!rawSpecies) return null;
  const query = rawSpecies.trim().toLowerCase();
  if (!query) return null;

  // Direct ID match
  const byId = SPECIES_CATALOG.find((s) => s.id === query);
  if (byId) return byId;

  // Direct Name match
  const byName = SPECIES_CATALOG.find((s) => s.name.toLowerCase() === query);
  if (byName) return byName;

  // Alias lookup
  const byAlias = SPECIES_CATALOG.find((s) => s.aliases.some((a) => a.toLowerCase() === query || query.includes(a.toLowerCase())));
  if (byAlias) return byAlias;

  // Substring match on name
  const bySub = SPECIES_CATALOG.find((s) => s.name.toLowerCase().includes(query) || query.includes(s.id));
  if (bySub) return bySub;

  if (query === "reptile") {
    return SPECIES_CATALOG.find((s) => s.id === "ball_python") ?? null;
  }
  if (query === "bird") {
    return SPECIES_CATALOG.find((s) => s.id === "caged_bird") ?? null;
  }

  return null;
}

/**
 * Verify whether an animal listing or litter is permissible under federal,
 * state, and municipal statutory constraints.
 */
export function verifySpeciesListingCompliance(
  rawSpecies: string | null | undefined,
  titleOrBreed?: string | null
): {
  allowed: boolean;
  tier: RegulatoryTier;
  profile: SpeciesLegalProfile | null;
  notice?: string;
  disclaimer?: string;
} {
  const combined = `${rawSpecies ?? ""} ${titleOrBreed ?? ""}`.trim().toLowerCase();

  // Prefer specific breed/title profile if it matches, then fall back to species
  const specificProfile = titleOrBreed ? lookupSpeciesProfile(titleOrBreed) : null;
  const profile = specificProfile ?? lookupSpeciesProfile(combined) ?? lookupSpeciesProfile(rawSpecies);

  if (profile) {
    if (!profile.commercialListingAllowed || profile.tier === 6) {
      return {
        allowed: false,
        tier: 6,
        profile,
        notice: profile.prohibitionNotice ?? "Listing prohibited under federal wildlife statute.",
      };
    }
    return {
      allowed: true,
      tier: profile.tier,
      profile,
      disclaimer: profile.complianceDisclaimer,
    };
  }

  // Check for big cat or injurious keywords in unclassified titles
  const BIG_CAT_REGEX = /\b(lion|tiger|leopard|snow leopard|clouded leopard|jaguar|cheetah|cougar|mountain lion|puma|liger|tigon)\b/i;
  if (BIG_CAT_REGEX.test(combined)) {
    const bigCatProfile = SPECIES_CATALOG.find((s) => s.id === "big_cat")!;
    return {
      allowed: false,
      tier: 6,
      profile: bigCatProfile,
      notice: bigCatProfile.prohibitionNotice,
    };
  }

  return {
    allowed: true,
    tier: 1,
    profile: null,
  };
}
