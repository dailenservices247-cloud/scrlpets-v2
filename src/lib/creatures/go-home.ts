export type GoHomeTimeline = {
  birthDate: string;
  eligibleGoHomeDate: string;
  minAgeWeeks: number;
  ageDays: number;
  ageWeeks: number;
  daysUntilReady: number;
  isReadyToGoHome: boolean;
};

const MIN_GO_HOME_DAYS_BY_SPECIES: Record<string, number> = {
  dog: 56, // 8 weeks (9 CFR 2.130 standard)
  cat: 56, // 8 weeks (9 CFR 2.130 standard)
  rabbit: 56, // 8 weeks weaning standard
};

function parseDateOnlyUtc(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateOnlyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Computes the premeditated Go-Home Readiness window from an animal's birth
 * date and species so buyers, breeders, and carriers can coordinate transport
 * and balance payments around concrete dates.
 */
export function computeGoHomeTimeline(
  species: string | null | undefined,
  birthDate: string | null | undefined,
  referenceDate: Date = new Date(),
): GoHomeTimeline | null {
  if (!birthDate) return null;
  const born = parseDateOnlyUtc(birthDate);
  if (!born) return null;

  const refUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );

  const normalizedSpecies = species?.trim().toLowerCase() ?? "";
  const minDays = MIN_GO_HOME_DAYS_BY_SPECIES[normalizedSpecies] ?? 0;
  const minAgeWeeks = Math.round(minDays / 7);

  const eligibleUtc = new Date(born.getTime() + minDays * 86_400_000);
  const ageDays = Math.max(0, Math.floor((refUtc.getTime() - born.getTime()) / 86_400_000));
  const ageWeeks = Math.floor(ageDays / 7);
  const daysUntilReady = Math.max(
    0,
    Math.ceil((eligibleUtc.getTime() - refUtc.getTime()) / 86_400_000),
  );

  return {
    birthDate: formatDateOnlyUtc(born),
    eligibleGoHomeDate: formatDateOnlyUtc(eligibleUtc),
    minAgeWeeks,
    ageDays,
    ageWeeks,
    daysUntilReady,
    isReadyToGoHome: daysUntilReady === 0,
  };
}
