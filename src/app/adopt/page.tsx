import { permanentRedirect } from "next/navigation";

// Merged into /market. Adoption is now an intent filter on the Animals tab
// rather than its own surface — the split was never conceptual, it was two
// filters on one table that left sale-with-an-animal browsable nowhere.
export default async function AdoptPage() {
  permanentRedirect("/market?tab=animals&intent=adoption");
}
