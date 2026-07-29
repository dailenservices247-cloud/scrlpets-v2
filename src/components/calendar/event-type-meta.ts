import {
  Baby,
  Dumbbell,
  HeartHandshake,
  HeartPulse,
  Stethoscope,
  Thermometer,
  ThermometerSnowflake,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { BreedingEventType } from "@/lib/breeding/constants";

/** Icons live here (components), not in lib/breeding/constants.ts — lib/
 * stays React-free everywhere else in this codebase. */
export const EVENT_TYPE_ICON: Record<BreedingEventType, LucideIcon> = {
  heat_start: Thermometer,
  heat_end: ThermometerSnowflake,
  mating: HeartHandshake,
  pregnancy_confirmed: HeartPulse,
  birth: Baby,
  vet_visit: Stethoscope,
  show: Trophy,
  training: Dumbbell,
};
