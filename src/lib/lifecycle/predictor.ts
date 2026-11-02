export type AnimalSpeciesCategory = "insect" | "reptile" | "bird" | "mammal";

export type AntNuptialInput = {
  speciesName?: string;
  temperatureF: number;
  humidityPercent: number;
  daysSinceRain: number;
  month: number; // 1 - 12
};

export type AntNuptialResult = {
  score: number; // 0 - 100
  condition: "optimal" | "favorable" | "unlikely";
  guidance: string;
  recommendedSpecies: string[];
};

export type FoundingStage = {
  dayOffset: number;
  title: string;
  stage: "capture" | "eggs" | "larvae" | "pupae" | "nanitics" | "outworld";
  description: string;
  actionRequired: string;
};

export type IncubationInput = {
  speciesName: "bearded_dragon" | "crested_gecko" | "ball_python" | "leopard_gecko" | "cockatiel";
  clutchDate: string; // ISO date
  incubationTempF: number;
  humidityPercent: number;
};

export type IncubationResult = {
  projectedHatchDate: string;
  estimatedDays: number;
  status: "ideal" | "warning_temp" | "warning_humidity";
  tsdNote?: string; // Temperature-dependent sex determination
  guidance: string;
};

export type MammalReproInput = {
  species: "dog" | "cat" | "rabbit";
  eventDate: string; // ISO date
  progesteroneLevelNgMl?: number;
};

export type MammalReproResult = {
  stage: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  projectedDueDate: string;
  ultrasoundWindow: string;
  guidance: string;
};

/**
 * Predicts Queen Ant Nuptial Flight probability based on environmental variables.
 */
export function predictAntNuptialFlight(input: AntNuptialInput): AntNuptialResult {
  let score = 50;
  const activeSpecies: string[] = [];

  // Optimal temperature: 75°F - 88°F
  if (input.temperatureF >= 75 && input.temperatureF <= 88) {
    score += 25;
  } else if (input.temperatureF < 68 || input.temperatureF > 95) {
    score -= 30;
  }

  // Humidity: Ants fly during high humidity (>60%) often 1-2 days after warm summer rain
  if (input.humidityPercent >= 65) {
    score += 20;
  } else if (input.humidityPercent < 45) {
    score -= 20;
  }

  if (input.daysSinceRain >= 1 && input.daysSinceRain <= 3) {
    score += 15;
  }

  // Seasonality (North America / Northern Hemisphere)
  if (input.month >= 5 && input.month <= 8) {
    score += 10;
    activeSpecies.push("Camponotus (Carpenter Ants)", "Tetramorium (Pavement Ants)", "Lasius (Citronella / Field Ants)");
  }
  if (input.month >= 7 && input.month <= 9) {
    activeSpecies.push("Pogonomyrmex (Harvester Ants)", "Solenopsis (Fire Ants)");
  }

  score = Math.max(0, Math.min(100, score));

  let condition: "optimal" | "favorable" | "unlikely" = "unlikely";
  let guidance = "Conditions are unfavorable for nuptial flights. Wait for a warm day after rainfall.";

  if (score >= 80) {
    condition = "optimal";
    guidance = "Prime flight conditions! Look on sidewalks, tree trunks, and under outdoor porch lights at dusk for dealate (de-winged) queen ants.";
  } else if (score >= 60) {
    condition = "favorable";
    guidance = "Moderate chance of flights. Warm humid pockets and sunlit borders may yield fertile queens.";
  }

  return {
    score,
    condition,
    guidance,
    recommendedSpecies: activeSpecies.length > 0 ? activeSpecies : ["General Regional Formicinae"],
  };
}

/**
 * Generates the founding timeline for a newly caught queen ant.
 */
export function calculateAntFoundingTimeline(): FoundingStage[] {
  return [
    {
      dayOffset: 0,
      title: "Queen Capture & Dark Claustral Chamber",
      stage: "capture",
      description: "Dealate queen housed in sterile test tube with 50% water reservoir and snug cotton plug.",
      actionRequired: "Place in a dark, quiet cabinet (75°F-80°F). Do not disturb for 7-10 days.",
    },
    {
      dayOffset: 10,
      title: "First Egg Clutch Laid",
      stage: "eggs",
      description: "Queen lays initial cluster of microscopic white/amber eggs.",
      actionRequired: "Check once briefly with red light. Do not feed (claustral queens metabolize wing muscles).",
    },
    {
      dayOffset: 25,
      title: "Larval Development",
      stage: "larvae",
      description: "Eggs hatch into hungry larvae cared for and groomed by the queen.",
      actionRequired: "Maintain constant humidity. Keep undisturbed.",
    },
    {
      dayOffset: 42,
      title: "Pupation (Cocoons / Naked Pupae)",
      stage: "pupae",
      description: "Larvae spin silk cocoons or enter naked pupal stage, darkening as eyes develop.",
      actionRequired: "Ensure cotton reservoir is moist. Nanitics expected within 10-14 days.",
    },
    {
      dayOffset: 55,
      title: "First Nanitics Eclose (Colony Founded!)",
      stage: "nanitics",
      description: "First generation of small worker ants emerge and assist the queen.",
      actionRequired: "Offer first feeding: tiny drop of honey/sugar water on foil + prekilled fruit fly.",
    },
    {
      dayOffset: 90,
      title: "Outworld Expansion",
      stage: "outworld",
      description: "Worker population reaches 15-25 ants. Foraging drive increases.",
      actionRequired: "Connect test tube to a ventilated outworld with fluon/talc escape barrier.",
    },
  ];
}

/**
 * Calculates reptile or avian egg incubation duration and pipping forecast.
 */
export function calculateClutchIncubation(input: IncubationInput): IncubationResult {
  const clutch = new Date(input.clutchDate);
  let baseDays = 60;
  let idealTemp = 83;
  let idealHumidity = 60;
  let tsdNote: string | undefined;

  switch (input.speciesName) {
    case "bearded_dragon":
      baseDays = 60;
      idealTemp = 83;
      idealHumidity = 65;
      break;
    case "crested_gecko":
      baseDays = 72;
      idealTemp = 72;
      idealHumidity = 75;
      break;
    case "ball_python":
      baseDays = 58;
      idealTemp = 89;
      idealHumidity = 95;
      break;
    case "leopard_gecko":
      baseDays = input.incubationTempF <= 81 ? 65 : 45;
      idealTemp = 84;
      idealHumidity = 70;
      tsdNote = input.incubationTempF <= 81 ? "80°F-81°F yields ~95% females" : input.incubationTempF >= 88 ? "88°F-90°F yields ~95% males" : "84°F yields a 50/50 mix";
      break;
    case "cockatiel":
      baseDays = 20;
      idealTemp = 99.5;
      idealHumidity = 55;
      break;
  }

  // Temperature acceleration / deceleration: 1 degree warmer shortens by ~2-3 days, cooler extends
  const tempDelta = input.incubationTempF - idealTemp;
  const estimatedDays = Math.round(baseDays - tempDelta * 2.5);

  const hatch = new Date(clutch);
  hatch.setDate(hatch.getDate() + estimatedDays);

  let status: "ideal" | "warning_temp" | "warning_humidity" = "ideal";
  let guidance = "Incubation environment is on target for healthy embryo development.";

  if (Math.abs(input.incubationTempF - idealTemp) > 4) {
    status = "warning_temp";
    guidance = `Temperature deviates from optimal (${idealTemp}°F). Extreme temperatures can cause developmental defects or clutch loss.`;
  } else if (input.humidityPercent < idealHumidity - 15) {
    status = "warning_humidity";
    guidance = `Humidity is low (target ~${idealHumidity}%). Eggs may dent or dehydrate without misting substrate.`;
  }

  return {
    projectedHatchDate: hatch.toISOString().split("T")[0],
    estimatedDays,
    status,
    tsdNote,
    guidance,
  };
}

/**
 * Calculates mammalian ovulation and gestation windows (canine, feline, rabbit).
 */
export function calculateMammalReproduction(input: MammalReproInput): MammalReproResult {
  const event = new Date(input.eventDate);
  let gestationDays = 63;
  let stage = "Active Heat";
  let guidance = "";

  if (input.species === "rabbit") {
    gestationDays = 31;
    stage = "Kindling Gestation";
    guidance = "Rabbits are induced ovulators. Provide a nesting box with clean hay on Day 28.";
  } else if (input.species === "cat") {
    gestationDays = 65;
    stage = "Queening Gestation";
    guidance = "Feline gestation averages 64-67 days. Prepare a quiet queening box 10 days prior.";
  } else {
    // Canine with Progesterone Mapping
    const prog = input.progesteroneLevelNgMl ?? 5.0;
    if (prog < 2.0) {
      stage = "Anestrus / Early Proestrus";
      guidance = "Baseline progesterone (<2.0 ng/mL). Retest blood in 3-4 days to detect LH surge.";
    } else if (prog >= 2.0 && prog < 4.5) {
      stage = "LH Surge Detected";
      guidance = "LH surge in progress (2.0-4.0 ng/mL). Ovulation typically occurs in 48 hours.";
    } else if (prog >= 4.5 && prog <= 9.0) {
      stage = "Ovulation (5.0 ng/mL Anchor)";
      guidance = "Ovulation confirmed! Ova take 48 hours to mature. Optimal breeding window opens in 48-72 hours.";
    } else {
      stage = "Peak Fertile Window (10-20+ ng/mL)";
      guidance = "Ova are mature. Optimal time for natural mating, side-by-side AI, or TCI/surgical insemination.";
    }
  }

  const fertileStart = new Date(event);
  fertileStart.setDate(fertileStart.getDate() + 2);

  const fertileEnd = new Date(event);
  fertileEnd.setDate(fertileEnd.getDate() + 5);

  const due = new Date(event);
  due.setDate(due.getDate() + gestationDays);

  const ultrasound = new Date(event);
  ultrasound.setDate(ultrasound.getDate() + 28);

  return {
    stage,
    fertileWindowStart: fertileStart.toISOString().split("T")[0],
    fertileWindowEnd: fertileEnd.toISOString().split("T")[0],
    projectedDueDate: due.toISOString().split("T")[0],
    ultrasoundWindow: `${ultrasound.toISOString().split("T")[0]} (Day 28-32)`,
    guidance,
  };
}
