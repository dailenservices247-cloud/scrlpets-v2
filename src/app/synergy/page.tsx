import type { Metadata } from "next";
import { SynergyEcosystemClient } from "@/components/synergy/SynergyEcosystemClient";

export const metadata: Metadata = {
  title: "Synergy OS — Multi-Vertical Ecosystem & Messenger | Black Sheep 247",
  description:
    "Interactive prototype of Synergy OS, Auto-Connected Synergy Messenger, Vertical #2 (Tech, Gaming & AI Work Stack), and Vertical #3 (Food Reviews & Recipes).",
};

export default function SynergyPage() {
  return <SynergyEcosystemClient />;
}
