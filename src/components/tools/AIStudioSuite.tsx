"use client";

import { useState } from "react";
import {
  Wand2,
  Copy,
  Check,
  FileSignature,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import {
  generateListingDraft,
  generateUniversalContract,
  generateVetPrepChecklist,
} from "@/lib/ai/studio";
import { taxonomyLabelForSpecies } from "@/lib/species/identity";

export function AIStudioSuite() {
  const [activeTool, setActiveTool] = useState<"listing" | "contract" | "vet">("listing");
  const [selectedSpecies, setSelectedSpecies] = useState("insect");
  const [copied, setCopied] = useState(false);

  // Listing Drafter State
  const [rawNotes, setRawNotes] = useState(
    "Mated Camponotus pennsylvanicus queen with 8 nanitic workers and healthy brood pile. Founded July 2026. Feeds on honey water and fruit flies. Comes in glass test tube setup.",
  );
  const [priceInput, setPriceInput] = useState(45);

  // Contract Drafter State
  const [animalName, setAnimalName] = useState("Pennsylvanicus Colony #4");
  const [subtype, setSubtype] = useState("Eastern Black Carpenter Ant");
  const [sellerName, setSellerName] = useState("Apex Insectary");
  const [buyerName, setBuyerName] = useState("John Doe");
  const [contractPrice, setContractPrice] = useState(45);
  const [lagHours, setLagHours] = useState(2);

  // Vet Prep State
  const [symptomInput, setSymptomInput] = useState("Slight lethargy and reduced appetite for 48 hours");

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const listingResult = generateListingDraft({
    species: selectedSpecies,
    rawNotes,
    priceCents: priceInput * 100,
  });

  const contractText = generateUniversalContract({
    species: selectedSpecies,
    animalName,
    subtype,
    sellerName,
    buyerName,
    priceCents: contractPrice * 100,
    lagHours,
  });

  const vetChecklist = generateVetPrepChecklist(selectedSpecies, symptomInput);

  return (
    <div className="premium-panel rounded-2xl p-4 sm:p-5" data-testid="ai-studio-suite">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-brand-link">
              <Sparkles className="size-4" />
            </span>
            <h2 className="text-lg font-bold tracking-tight">Scrlpets AI Studio</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Honest drafting aids, live contracts, and species-aware assistants for all animal keepers
          </p>
        </div>

        {/* Species Filter Pill */}
        <div className="flex items-center gap-2">
          <span className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
            Species:
          </span>
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-semibold"
            data-testid="studio-species-select"
          >
            <option value="insect">Insect / Colony (Ants, Bees)</option>
            <option value="reptile">Reptile (Lizard, Snake, Gecko)</option>
            <option value="dog">Canine (Dog)</option>
            <option value="cat">Feline (Cat)</option>
            <option value="bird">Avian (Bird, Parrot)</option>
            <option value="rabbit">Lagomorph (Rabbit)</option>
            <option value="fish">Aquatic (Fish)</option>
            <option value="other">Universal Animal</option>
          </select>
        </div>
      </div>

      {/* Tool Navigation Tabs */}
      <div className="mt-4 flex gap-2 border-b border-border/50 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTool("listing")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            activeTool === "listing"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-tool-listing"
        >
          <Wand2 className="size-3.5" />
          <span>Listing Drafter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool("contract")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            activeTool === "contract"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-tool-contract"
        >
          <FileSignature className="size-3.5" />
          <span>Contract & LAG Drafter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool("vet")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            activeTool === "vet"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-tool-vet"
        >
          <Stethoscope className="size-3.5" />
          <span>Vet-Visit Prep</span>
        </button>
      </div>

      {/* TOOL 1: LISTING DRAFTER */}
      {activeTool === "listing" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Input Raw Keeper Notes
            </h3>
            <textarea
              rows={4}
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Paste raw notes or dictated voice transcript..."
              className="w-full rounded-xl border border-input bg-background p-2.5 text-xs leading-relaxed"
              data-testid="studio-listing-input"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium">Price ($ USD):</label>
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(Number(e.target.value))}
                className="w-24 rounded-lg border border-input bg-background p-1.5 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-link">Formatted Listing Preview</span>
              <button
                type="button"
                onClick={() => copyText(`${listingResult.title}\n\n${listingResult.description}`)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-micro font-medium hover:bg-muted"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copied ? "Copied" : "Copy Listing"}</span>
              </button>
            </div>

            <p className="font-bold text-sm text-foreground">{listingResult.title}</p>
            <p className="whitespace-pre-line text-xs text-muted-foreground leading-relaxed">
              {listingResult.description}
            </p>

            <div className="mt-2 rounded-lg bg-muted/40 p-2 text-micro">
              <p className="font-semibold text-foreground">Shipping & Handover Terms:</p>
              <p className="text-muted-foreground">{listingResult.shippingTerms}</p>
            </div>

            <div className="mt-1 flex flex-wrap gap-1">
              {listingResult.recommendedTags.map((tag) => (
                <span key={tag} className="rounded-md bg-primary/10 px-2 py-0.5 text-micro font-medium text-brand-link">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOOL 2: CONTRACT & LAG DRAFTER */}
      {activeTool === "contract" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3.5 text-xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agreement Parameters
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-micro font-medium">Animal Designation</label>
                <input
                  type="text"
                  value={animalName}
                  onChange={(e) => setAnimalName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-micro font-medium">{taxonomyLabelForSpecies(selectedSpecies)}</label>
                <input
                  type="text"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-micro font-medium">Seller Name / Establishment</label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-micro font-medium">Buyer Name</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-micro font-medium">Agreed Price ($)</label>
                <input
                  type="number"
                  value={contractPrice}
                  onChange={(e) => setContractPrice(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-micro font-medium">LAG Video Window (Hours)</label>
                <input
                  type="number"
                  value={lagHours}
                  onChange={(e) => setLagHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-link">Generated Contract Text</span>
              <button
                type="button"
                onClick={() => copyText(contractText)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-micro font-medium hover:bg-muted"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copied ? "Copied" : "Copy Agreement"}</span>
              </button>
            </div>
            <pre className="h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-micro text-foreground/90">
              {contractText}
            </pre>
          </div>
        </div>
      )}

      {/* TOOL 3: VET-VISIT PREP */}
      {activeTool === "vet" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3.5 text-xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Keeper Symptom Observations
            </h3>
            <textarea
              rows={4}
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              placeholder="Describe observations, appetite changes, or behavior..."
              className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
            />
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-link">
                Vet Observation Prep Checklist
              </span>
              <button
                type="button"
                onClick={() => copyText(vetChecklist.join("\n- "))}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-micro font-medium hover:bg-muted"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copied ? "Copied" : "Copy Checklist"}</span>
              </button>
            </div>
            <ul className="space-y-2 text-xs">
              {vetChecklist.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 rounded-lg bg-muted/30 p-2 text-foreground/90">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary/20 text-micro font-bold text-brand-link">
                    {idx + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
