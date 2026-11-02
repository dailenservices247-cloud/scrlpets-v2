import { AppPage } from "@/components/app/AppPage";
import { AIStudioSuite } from "@/components/tools/AIStudioSuite";

export const metadata = {
  title: "AI Studio & Breeder Assistant | Scrlpets",
  description: "Species-aware drafting aids, Live Arrival Guarantee contracts, and vet prep tools.",
};

export default function ToolsPage() {
  return (
    <AppPage>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <AIStudioSuite />
      </div>
    </AppPage>
  );
}
