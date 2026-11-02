/**
 * Universal Pet Husbandry & Habitat Care System.
 *
 * One unified umbrella for all animals on Scrlpets — dogs, cats, rabbits,
 * birds, reptiles, insects/colonies, and aquatics. Every creature has
 * environmental requirements, nutritional schedules, and developmental milestones.
 */

export type HabitatParameters = {
  temperature: {
    warmZone?: number;
    coolZone?: number;
    ambient: number;
    current: number;
    unit: "F" | "C";
  };
  humidity: {
    targetMin: number;
    targetMax: number;
    current: number;
  };
  enclosureType: string;
  lighting?: {
    uvbRating?: string;
    photoperiodHours: number;
  };
  substrate?: string;
  mistingCadence?: string;
};

export type FeedingFrequency =
  | "daily"
  | "every_2_days"
  | "twice_weekly"
  | "weekly"
  | "biweekly";

export type FeedingSchedule = {
  dietType: string;
  items: string[];
  frequency: FeedingFrequency;
  lastFedAt: string;
  supplements?: string[];
};

export type ColonyBroodStages = {
  eggs: boolean;
  larvae: boolean;
  pupae: boolean;
};

export type PhysiologicalMilestones = {
  shedOrMolt?: {
    lastDate: string;
    status: "clear" | "in_shed" | "complete";
    notes?: string;
  };
  colonyMetrics?: {
    workerCount: number;
    queenStatus: "founding" | "single_queen" | "multi_queen" | "established";
    brood: ColonyBroodStages;
  };
  dormancy?: {
    active: boolean;
    type: "diapause" | "brumation" | "torpor" | "none";
    targetTempF?: number;
    startDate?: string;
  };
  weight?: {
    current: number;
    unit: "g" | "oz" | "lbs";
    lastWeighedAt: string;
    trend: "gaining" | "stable" | "losing";
  };
};

export type CreatureCareDossier = {
  creatureId: string;
  species: string;
  habitat: HabitatParameters;
  feeding: FeedingSchedule;
  milestones: PhysiologicalMilestones;
};

const FREQUENCY_DAYS: Record<FeedingFrequency, number> = {
  daily: 1,
  every_2_days: 2,
  twice_weekly: 3.5,
  weekly: 7,
  biweekly: 14,
};

/**
 * Calculates current feeding status based on last feeding timestamp and frequency.
 */
export function calculateFeedingStatus(
  lastFedAt: string,
  frequency: FeedingFrequency,
  now: Date = new Date(),
): {
  nextDueAt: string;
  status: "fed" | "due_soon" | "overdue";
  hoursRemaining: number;
} {
  const lastFed = new Date(lastFedAt);
  const intervalDays = FREQUENCY_DAYS[frequency] ?? 1;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const nextDue = new Date(lastFed.getTime() + intervalMs);

  const diffMs = nextDue.getTime() - now.getTime();
  const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));

  let status: "fed" | "due_soon" | "overdue";
  if (hoursRemaining < 0) {
    status = "overdue";
  } else if (hoursRemaining <= 12) {
    status = "due_soon";
  } else {
    status = "fed";
  }

  return {
    nextDueAt: nextDue.toISOString(),
    status,
    hoursRemaining,
  };
}

/**
 * Evaluates whether current environmental metrics are inside recommended boundaries.
 */
export function evaluateHabitatMetrics(
  habitat: HabitatParameters,
): {
  tempStatus: "optimal" | "warning" | "critical";
  humidityStatus: "optimal" | "warning" | "critical";
  alerts: string[];
} {
  const alerts: string[] = [];
  const currentTemp = habitat.temperature.current;
  const warmTarget = habitat.temperature.warmZone ?? habitat.temperature.ambient;
  const coolTarget = habitat.temperature.coolZone ?? habitat.temperature.ambient;

  let tempStatus: "optimal" | "warning" | "critical" = "optimal";
  if (currentTemp > warmTarget + 6 || currentTemp < coolTarget - 6) {
    tempStatus = "critical";
    alerts.push(`Critical temperature deviation: currently ${currentTemp}°${habitat.temperature.unit}`);
  } else if (currentTemp > warmTarget + 2 || currentTemp < coolTarget - 2) {
    tempStatus = "warning";
    alerts.push(`Temperature slightly out of range: ${currentTemp}°${habitat.temperature.unit}`);
  }

  let humidityStatus: "optimal" | "warning" | "critical" = "optimal";
  const { current: curH, targetMin, targetMax } = habitat.humidity;
  if (curH < targetMin - 15 || curH > targetMax + 15) {
    humidityStatus = "critical";
    alerts.push(`Critical humidity alert: ${curH}% (target ${targetMin}%-${targetMax}%)`);
  } else if (curH < targetMin || curH > targetMax) {
    humidityStatus = "warning";
    alerts.push(`Humidity out of nominal range: ${curH}% (target ${targetMin}%-${targetMax}%)`);
  }

  return {
    tempStatus,
    humidityStatus,
    alerts,
  };
}

/**
 * Pre-populates recommended husbandry baselines by species under one umbrella.
 */
export function getRecommendedCareDefaults(species: string): Omit<CreatureCareDossier, "creatureId"> {
  const s = species.trim().toLowerCase();

  if (s === "insect" || s === "ant") {
    return {
      species: "insect",
      habitat: {
        temperature: { ambient: 76, current: 77, unit: "F", warmZone: 82, coolZone: 74 },
        humidity: { targetMin: 60, targetMax: 80, current: 72 },
        enclosureType: "Formicarium / Test Tube Outworld",
        substrate: "Sand-clay loam / Plaster nest",
        mistingCadence: "Weekly reservoir hydration",
      },
      feeding: {
        dietType: "Sugar Water & Insect Protein",
        items: ["20% Organic Sugar/Honey Water", "Fruit Flies", "Mealworm Halves"],
        frequency: "every_2_days",
        lastFedAt: new Date().toISOString(),
        supplements: ["Liquid Ant Nectar"],
      },
      milestones: {
        colonyMetrics: {
          workerCount: 18,
          queenStatus: "single_queen",
          brood: { eggs: true, larvae: true, pupae: true },
        },
        dormancy: { active: false, type: "diapause", targetTempF: 48 },
      },
    };
  }

  if (s === "reptile") {
    return {
      species: "reptile",
      habitat: {
        temperature: { warmZone: 90, coolZone: 76, ambient: 82, current: 88, unit: "F" },
        humidity: { targetMin: 35, targetMax: 50, current: 42 },
        enclosureType: "Bioactive Vivarium",
        substrate: "Arid Topsoil / Sand Mix",
        lighting: { uvbRating: "10.0 T5 HO", photoperiodHours: 12 },
        mistingCadence: "Daily morning dew",
      },
      feeding: {
        dietType: "Gut-Loaded Insects & Calcium",
        items: ["Dubia Roaches", "Crickets", "Black Soldier Fly Larvae"],
        frequency: "twice_weekly",
        lastFedAt: new Date().toISOString(),
        supplements: ["Calcium w/ Vitamin D3", "Herptivite Multivitamin"],
      },
      milestones: {
        shedOrMolt: { lastDate: new Date().toISOString(), status: "complete", notes: "Clean single-piece shed" },
        dormancy: { active: false, type: "brumation", targetTempF: 65 },
        weight: { current: 65, unit: "g", lastWeighedAt: new Date().toISOString(), trend: "stable" },
      },
    };
  }

  if (s === "rabbit") {
    return {
      species: "rabbit",
      habitat: {
        temperature: { ambient: 68, current: 68, unit: "F" },
        humidity: { targetMin: 40, targetMax: 60, current: 50 },
        enclosureType: "Free-Roam Pen / Warren",
        substrate: "Recycled Paper Fleece",
      },
      feeding: {
        dietType: "Unlimited Hay & Fresh Greens",
        items: ["Timothy Hay", "Orchard Grass", "Romaine Lettuce", "Cilantro"],
        frequency: "daily",
        lastFedAt: new Date().toISOString(),
        supplements: ["Digestive Support Tablets"],
      },
      milestones: {
        weight: { current: 3.5, unit: "lbs", lastWeighedAt: new Date().toISOString(), trend: "stable" },
      },
    };
  }

  // Default: Dog / Cat / Companion
  return {
    species,
    habitat: {
      temperature: { ambient: 70, current: 70, unit: "F" },
      humidity: { targetMin: 35, targetMax: 55, current: 45 },
      enclosureType: "Home / Yard / Kennel Suite",
      substrate: "Orthopedic Bedding",
    },
    feeding: {
      dietType: "Complete Nutrition & Fresh Toppers",
      items: ["High-Protein Kibble", "Bone Broth", "Raw Freeze-Dried Toppers"],
      frequency: "daily",
      lastFedAt: new Date().toISOString(),
      supplements: ["Omega-3 Fish Oil", "Glucosamine / Chondroitin"],
    },
    milestones: {
      weight: { current: 55, unit: "lbs", lastWeighedAt: new Date().toISOString(), trend: "stable" },
    },
  };
}
