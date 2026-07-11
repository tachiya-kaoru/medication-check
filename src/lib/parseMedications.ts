import type { MedicationItem } from "@/lib/types";

export function parseMedicationList(raw: unknown): MedicationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? "").trim() || "（名称不明）",
      genericName: String(item.genericName ?? "").trim(),
      purpose: String(item.purpose ?? "").trim() || "—",
      // 歯科注意なしは空欄のまま（「—」に置き換えない）
      dentalNotes: String(item.dentalNotes ?? "").trim(),
      cautionLevel: normalizeCaution(item.cautionLevel),
    }));
}

export function stripJsonFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** AI応答の壊れやすいJSONをできるだけ救済してパースする */
export function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripJsonFence(text);

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = cleaned.slice(start, end + 1);
    try {
      const parsed = JSON.parse(sliced);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }

    // 末尾が切れた配列っぽい場合の簡易修復はせず、明確なエラーにする
  }

  throw new Error("AIの応答形式が不正でした。もう一度お試しください。");
}

function normalizeCaution(value: unknown): MedicationItem["cautionLevel"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}
