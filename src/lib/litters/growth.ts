export type PuppyWeightRecord = {
  day: number;
  weightGrams: number;
  recordedAt?: string;
};

export type PuppyGrowthProfile = {
  id: string;
  name: string;
  collarColor: string;
  birthWeightGrams: number;
  gender: "male" | "female";
  records: PuppyWeightRecord[];
};

export type GrowthVelocityStatus = "healthy" | "accelerated" | "lagging";

export type GrowthSummary = {
  currentWeightGrams: number;
  totalGainGrams: number;
  percentageGain: number;
  averageDailyGainGrams: number;
  last24hChangeGrams: number;
  status: GrowthVelocityStatus;
};

/**
 * Calculates growth metrics for a puppy given their birth weight and records.
 */
export function calculateGrowthSummary(
  birthWeightGrams: number,
  records: PuppyWeightRecord[],
): GrowthSummary {
  if (records.length === 0) {
    return {
      currentWeightGrams: birthWeightGrams,
      totalGainGrams: 0,
      percentageGain: 0,
      averageDailyGainGrams: 0,
      last24hChangeGrams: 0,
      status: "healthy",
    };
  }

  // Sort by day ascending
  const sorted = [...records].sort((a, b) => a.day - b.day);
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const currentWeightGrams = latest.weightGrams;
  const totalGainGrams = currentWeightGrams - birthWeightGrams;
  const percentageGain = birthWeightGrams > 0 ? (totalGainGrams / birthWeightGrams) * 100 : 0;

  const daysElapsed = Math.max(1, latest.day);
  const averageDailyGainGrams = totalGainGrams / daysElapsed;

  const last24hChangeGrams = previous ? currentWeightGrams - previous.weightGrams : totalGainGrams / daysElapsed;

  // Evaluation: healthy puppies gain 5-15% per day.
  // Less than 4% or negative change indicates need for surveillance.
  let status: GrowthVelocityStatus = "healthy";
  const dailyPercentGain = percentageGain / daysElapsed;
  if (last24hChangeGrams < 0 || dailyPercentGain < 4) {
    status = "lagging";
  } else if (dailyPercentGain > 15) {
    status = "accelerated";
  }

  return {
    currentWeightGrams,
    totalGainGrams,
    percentageGain,
    averageDailyGainGrams,
    last24hChangeGrams,
    status,
  };
}

/**
 * Calculates standard expected puppy weight progression curve (doubling by day 7-10).
 */
export function calculateBenchmarkCurve(
  birthWeightGrams: number,
  maxDay: number,
): { day: number; weightGrams: number }[] {
  const curve: { day: number; weightGrams: number }[] = [];
  // Standard healthy canine curve is ~8-10% daily gain compounding
  for (let day = 0; day <= maxDay; day++) {
    const multiplier = Math.pow(1.085, day);
    curve.push({
      day,
      weightGrams: Math.round(birthWeightGrams * multiplier),
    });
  }
  return curve;
}

/**
 * Converts grams to ounces.
 */
export function gramsToOunces(grams: number): number {
  return Number((grams * 0.035274).toFixed(1));
}
