import type { FeedItem } from "@/lib/feed/types";
import type { OwnedCreature, Profile } from "@/lib/profiles/queries";

export type ManagedBrandSummary = {
  slug: string;
  name: string;
  handle: string;
  kind: string;
  role: string;
  description: string;
  memberCount: number;
  packCount: number;
  collaboratorCount: number;
};

export type PackRelationshipSummary = {
  label: string;
  value: string;
  context: string;
};

export type ProfileIdentityModel = {
  brands: ManagedBrandSummary[];
  packRelationships: PackRelationshipSummary[];
};

export type BrandSurface = ManagedBrandSummary & {
  ownerUsername: string;
  ownerLabel: string;
  members: { name: string; role: string; href: string }[];
  packRelationships: PackRelationshipSummary[];
  collaborations: { brand: string; context: string; href: string }[];
};

const DEMO_BRAND: BrandSurface = {
  slug: "blue-river-kennels",
  name: "Blue River Kennels",
  handle: "@blueriverkennels",
  kind: "Kennel brand",
  role: "Owner",
  description: "Breeding program, animal listings, updates, and trusted pack relationships.",
  memberCount: 2,
  packCount: 18,
  collaboratorCount: 3,
  ownerUsername: "breeder_jane",
  ownerLabel: "Jane",
  members: [
    { name: "Jane", role: "Owner", href: "/u/breeder_jane" },
    { name: "Operations partner", role: "Listing manager", href: "/u/breeder_jane" },
  ],
  packRelationships: [
    {
      label: "Litter families",
      value: "12",
      context: "Buyers and families connected to past litters.",
    },
    {
      label: "Contract holders",
      value: "4",
      context: "Animals with co-own or breeding-rights context.",
    },
    {
      label: "Preferred clients",
      value: "2",
      context: "Customers who should receive relationship-aware updates.",
    },
  ],
  collaborations: [
    {
      brand: "Stone Creek Bullies",
      context: "Breeding partner for future cross-brand litter posts.",
      href: "/b/blue-river-kennels",
    },
    {
      brand: "Pet Fanatics",
      context: "Local product and feeder recommendation lane.",
      href: "/b/blue-river-kennels",
    },
  ],
};

export function getProfileIdentityModel({
  profile,
  creatures,
  feed,
}: {
  profile: Profile;
  creatures: OwnedCreature[];
  feed: FeedItem[];
}): ProfileIdentityModel {
  if (profile.username !== DEMO_BRAND.ownerUsername) {
    return {
      brands: [],
      packRelationships: creatures.length
        ? [
            {
              label: "Animal network",
              value: String(creatures.length),
              context: "Prepared for pack, buyer, and family relationships once schema lands.",
            },
          ]
        : [],
    };
  }

  const listings = feed.filter((item) => item.type === "listing").length;

  return {
    brands: [
      {
        slug: DEMO_BRAND.slug,
        name: DEMO_BRAND.name,
        handle: DEMO_BRAND.handle,
        kind: DEMO_BRAND.kind,
        role: DEMO_BRAND.role,
        description: DEMO_BRAND.description,
        memberCount: DEMO_BRAND.memberCount,
        packCount: DEMO_BRAND.packCount,
        collaboratorCount: DEMO_BRAND.collaboratorCount,
      },
    ],
    packRelationships: [
      {
        label: "Animals under care",
        value: String(creatures.length),
        context: "Animals can stay anchored to the brand while still linking back to the person.",
      },
      {
        label: "Active listings",
        value: String(listings),
        context: "Listings should show who posted and which brand they represent.",
      },
      {
        label: "Pack relationships",
        value: String(DEMO_BRAND.packCount),
        context: "Buyers, litter families, contract holders, and close business relationships.",
      },
    ],
  };
}

export function getBrandSurfaceBySlug(slug: string): BrandSurface | null {
  return slug === DEMO_BRAND.slug ? DEMO_BRAND : null;
}
