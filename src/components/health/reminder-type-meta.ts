import {
  Bug,
  MoreHorizontal,
  Pill,
  Scissors,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import type { HealthReminderType } from "@/lib/health/constants";

export const REMINDER_TYPE_ICON: Record<HealthReminderType, LucideIcon> = {
  vaccination: Syringe,
  vet_visit: Stethoscope,
  medication: Pill,
  grooming: Scissors,
  deworming: Bug,
  other: MoreHorizontal,
};
