import { permanentRedirect } from "next/navigation";

// Merged into /market. Animals are browsable under /market?tab=animals.
export default async function AdoptPage() {
  permanentRedirect("/market?tab=animals");
}
