"use server";

import { createClient } from "@/lib/supabase/server";

export type GuaranteeTemplate = {
  key: string;
  name: string;
  coverageDescription: string;
  durationDays: number;
  remedy: "vet_costs" | "replacement" | "refund_on_return";
  conditions: string[];
};

export type GuaranteeText = {
  kind: "none" | "template" | "custom";
  headline: string;
  body: string;
  remedy: string | null;
  remedySentence: string | null;
  durationDays: number | null;
  conditions: string[];
};

export async function listGuaranteeTemplates(): Promise<GuaranteeTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guarantee_templates")
    .select("key,name,coverage_description,duration_days,remedy,conditions")
    .eq("enabled", true)
    .order("sort_order");
  return ((data ?? []) as {
    key: string;
    name: string;
    coverage_description: string;
    duration_days: number;
    remedy: GuaranteeTemplate["remedy"];
    conditions: string[];
  }[]).map((t) => ({
    key: t.key,
    name: t.name,
    coverageDescription: t.coverage_description,
    durationDays: t.duration_days,
    remedy: t.remedy,
    conditions: t.conditions ?? [],
  }));
}

/**
 * The buyer's-eye preview.
 *
 * Calls `guarantee_text_for` — the SAME function the listing page renders from,
 * not a client-side reconstruction of the same sentences. Ruling 3 promised a
 * seller "a preview of exactly how their terms will read to a buyer", and the
 * fairness of resolving ambiguity against them depends on the showing being
 * exact. A preview assembled separately is a preview that can drift, and the day
 * it drifts contra proferentem stops being fair.
 */
export async function previewGuarantee(input: {
  kind: "none" | "template" | "custom";
  templateKey?: string | null;
  customTerms?: string | null;
  customRemedy?: string | null;
  customDurationDays?: number | null;
}): Promise<GuaranteeText | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("guarantee_text_for", {
    g_kind: input.kind,
    g_template_key: input.templateKey ?? null,
    g_custom_terms: input.customTerms ?? null,
    g_custom_remedy: input.customRemedy ?? null,
    g_custom_duration_days: input.customDurationDays ?? null,
  });
  const row = (data as
    | {
        kind: GuaranteeText["kind"];
        headline: string;
        body: string;
        remedy: string | null;
        remedy_sentence: string | null;
        duration_days: number | null;
        conditions: string[] | null;
      }[]
    | null)?.[0];
  if (!row) return null;
  return {
    kind: row.kind,
    headline: row.headline,
    body: row.body,
    remedy: row.remedy,
    remedySentence: row.remedy_sentence,
    durationDays: row.duration_days,
    conditions: row.conditions ?? [],
  };
}

export type GuaranteePreviewCatalog = {
  none: GuaranteeText;
  byTemplate: Record<string, GuaranteeText>;
  /** Headline + the three remedy sentences, for previewing a seller's own terms. */
  customHeadline: string;
  remedySentences: Record<"vet_costs" | "replacement" | "refund_on_return", string>;
};

/**
 * Every rendering the picker can need, fetched ONCE.
 *
 * Previously the picker called `previewGuarantee` on every change. That was one
 * server action per keystroke, and — because Next serialises server actions —
 * an in-flight preview could queue behind it the navigation that follows Save.
 * The save applied and the page simply did not move, which is the worst kind of
 * failure to hand a seller.
 *
 * The words still come from the database renderer; they are just collected up
 * front instead of per change. Nothing is composed client-side except which
 * pre-rendered text to show, plus the seller's own typed body.
 */
export async function getGuaranteePreviewCatalog(): Promise<GuaranteePreviewCatalog> {
  const templates = await listGuaranteeTemplates();
  const [none, ...rendered] = await Promise.all([
    previewGuarantee({ kind: "none" }),
    ...templates.map((t) => previewGuarantee({ kind: "template", templateKey: t.key })),
  ]);

  const remedies = ["vet_costs", "replacement", "refund_on_return"] as const;
  const samples = await Promise.all(
    remedies.map((r) =>
      previewGuarantee({
        kind: "custom",
        customTerms: "sample",
        customRemedy: r,
        customDurationDays: 1,
      }),
    ),
  );

  const byTemplate: Record<string, GuaranteeText> = {};
  templates.forEach((t, i) => {
    const text = rendered[i];
    if (text) byTemplate[t.key] = text;
  });

  return {
    none: none!,
    byTemplate,
    customHeadline: samples[0]?.headline ?? "",
    remedySentences: {
      vet_costs: samples[0]?.remedySentence ?? "",
      replacement: samples[1]?.remedySentence ?? "",
      refund_on_return: samples[2]?.remedySentence ?? "",
    },
  };
}
