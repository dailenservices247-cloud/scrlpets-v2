/**
 * Unified Community Field & Habitat Observations.
 *
 * All pet keepers and animal stewards share local environmental conditions,
 * weather cues, and biological observations (flight sightings, coat shedding,
 * outdoor run weather alerts, foraging safety) under one single umbrella.
 */

export type ObservationCategory =
  | "flight_sighting"
  | "seasonal_transition"
  | "weather_alert"
  | "husbandry_tip";

export type CommunityObservation = {
  id: string;
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  location: string;
  date: string;
  category: ObservationCategory;
  species: string;
  title: string;
  content: string;
  metrics?: {
    tempF?: number;
    humidity?: number;
    rainRecently?: boolean;
    stageOrCondition?: string;
  };
  verified: boolean;
};

export const INITIAL_COMMUNITY_OBSERVATIONS: CommunityObservation[] = [
  {
    id: "obs-1",
    author: {
      username: "antscapemasters",
      displayName: "Antscape Masters",
      avatarUrl: null,
    },
    location: "Cuyahoga County, OH",
    date: new Date(Date.now() - 3600000 * 4).toISOString(),
    category: "flight_sighting",
    species: "insect",
    title: "Tetramorium Immigrans Nuptial Flight Activity",
    content:
      "Heavy nuptial flight activity observed on concrete sidewalks around 7:30 PM. Calm evening following mild afternoon rain. Multiple dealate queens spotted seeking claustral founding nesting sites.",
    metrics: {
      tempF: 78,
      humidity: 74,
      rainRecently: true,
      stageOrCondition: "Dealate Queens",
    },
    verified: true,
  },
  {
    id: "obs-2",
    author: {
      username: "danusark",
      displayName: "Danu's Ark",
      avatarUrl: null,
    },
    location: "Medina, OH",
    date: new Date(Date.now() - 3600000 * 12).toISOString(),
    category: "weather_alert",
    species: "dog",
    title: "Frost Warning & Morning Outdoor Run Protocol",
    content:
      "Overnight lows dropping into high 30s. Ensure outdoor kennel floor radiant heating is active and working dogs are thoroughly dried post-field exercise.",
    metrics: {
      tempF: 39,
      humidity: 82,
      stageOrCondition: "Frost Advisory",
    },
    verified: true,
  },
  {
    id: "obs-3",
    author: {
      username: "scaleandleaf",
      displayName: "Scale & Leaf Terrariums",
      avatarUrl: null,
    },
    location: "Lake County, OH",
    date: new Date(Date.now() - 3600000 * 24).toISOString(),
    category: "seasonal_transition",
    species: "reptile",
    title: "Pre-Winter Humidity Maintenance in Bioactive Vivaria",
    content:
      "Indoor furnace heating has reduced ambient house humidity to 25%. Check vivarium top screen glass coverage and increase daily automated misting intervals to keep microclimates above 45%.",
    metrics: {
      tempF: 74,
      humidity: 48,
      stageOrCondition: "Winter Ambient Drop",
    },
    verified: true,
  },
  {
    id: "obs-4",
    author: {
      username: "meadowhop",
      displayName: "Meadow Hop Warrens",
      avatarUrl: null,
    },
    location: "Summit County, OH",
    date: new Date(Date.now() - 3600000 * 36).toISOString(),
    category: "seasonal_transition",
    species: "rabbit",
    title: "Fall Coat Blow & Dense Undercoat Transition",
    content:
      "Noticeable increase in hair shedding across all Holland Lops. Daily comb-outs recommended to prevent wool block. Increased orchard grass and digestive papaya enzymes given.",
    metrics: {
      tempF: 52,
      humidity: 60,
      stageOrCondition: "Undercoat Molt",
    },
    verified: true,
  },
];

export function listCommunityObservations(filters?: {
  species?: string;
  category?: ObservationCategory;
  searchQuery?: string;
}): CommunityObservation[] {
  let list = [...INITIAL_COMMUNITY_OBSERVATIONS];

  if (filters?.species && filters.species !== "all") {
    const s = filters.species.toLowerCase();
    list = list.filter((obs) => obs.species.toLowerCase() === s);
  }

  if (filters?.category) {
    list = list.filter((obs) => obs.category === filters.category);
  }

  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    list = list.filter(
      (obs) =>
        obs.title.toLowerCase().includes(q) ||
        obs.content.toLowerCase().includes(q) ||
        obs.location.toLowerCase().includes(q),
    );
  }

  return list;
}

export function formatObservationCategoryLabel(category: ObservationCategory): string {
  switch (category) {
    case "flight_sighting":
      return "Flight Sighting";
    case "seasonal_transition":
      return "Seasonal Transition";
    case "weather_alert":
      return "Weather Advisory";
    case "husbandry_tip":
      return "Husbandry Insight";
    default:
      return "Field Observation";
  }
}
