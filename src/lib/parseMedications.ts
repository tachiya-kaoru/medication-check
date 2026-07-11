import type { MedicationItem } from "@/lib/types";

export function parseMedicationList(raw: unknown): MedicationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? "").trim() || "（名称不明）",
      genericName: String(item.genericName ?? "").trim(),
      purpose: String(item.purpose ?? "").trim() || "—",
      dentalNotes: String(item.dentalNotes ?? "").trim() || "—",
      cautionLevel: normalizeCaution(item.cautionLevel),
    }));
}

export function stripJsonFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeCaution(value: unknown): MedicationItem["cautionLevel"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}
