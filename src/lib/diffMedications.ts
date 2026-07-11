import type { CompareResult, MedicationItem } from "@/lib/types";

/** 表記ゆれを抑えるための正規化（比較用） */
export function normalizeDrugKey(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・･.．,，、]/g, "")
    .replace(
      /(錠|カプセル|カプ|散|顆粒|液|シロップ|軟膏|クリーム|テープ|パッチ|点眼|点鼻|吸入|mg|ｍｇ|g|ｇ|μg|ug|％|%)+$/g,
      ""
    )
    .replace(/(塩酸塩|ナトリウム|カルシウム|カリウム)$/g, "");
}

function tokensOf(med: MedicationItem): string[] {
  return [med.name, med.genericName]
    .map((t) => normalizeDrugKey(t))
    .filter((t) => t.length >= 2);
}

function isSameDrug(a: MedicationItem, b: MedicationItem): boolean {
  const aTokens = tokensOf(a);
  const bTokens = tokensOf(b);
  if (aTokens.length === 0 || bTokens.length === 0) return false;

  for (const at of aTokens) {
    for (const bt of bTokens) {
      if (at === bt) return true;
      // 一方が他方を含む（短い方は3文字以上）
      const shorter = at.length <= bt.length ? at : bt;
      const longer = at.length <= bt.length ? bt : at;
      if (shorter.length >= 3 && longer.includes(shorter)) return true;
    }
  }
  return false;
}

function mergeUnchanged(previous: MedicationItem, current: MedicationItem): MedicationItem {
  return {
    name: current.name || previous.name,
    genericName: current.genericName || previous.genericName,
    purpose:
      current.purpose && current.purpose !== "—"
        ? current.purpose
        : previous.purpose,
    dentalNotes: current.dentalNotes || previous.dentalNotes,
    cautionLevel:
      current.cautionLevel !== "low"
        ? current.cautionLevel
        : previous.cautionLevel,
  };
}

/**
 * 抽出済みリスト同士の差分（AIなし・高速）。
 * 抽出精度は維持したまま、分類だけをローカルで行う。
 */
export function diffMedicationsLocally(
  previous: MedicationItem[],
  current: MedicationItem[]
): CompareResult {
  const unmatchedCurrent = current.map((med, index) => ({ med, index }));
  const added: MedicationItem[] = [];
  const removed: MedicationItem[] = [];
  const unchanged: MedicationItem[] = [];
  const usedCurrent = new Set<number>();

  for (const prev of previous) {
    const match = unmatchedCurrent.find(
      ({ med, index }) => !usedCurrent.has(index) && isSameDrug(prev, med)
    );
    if (match) {
      usedCurrent.add(match.index);
      unchanged.push(mergeUnchanged(prev, match.med));
    } else {
      removed.push(prev);
    }
  }

  for (const { med, index } of unmatchedCurrent) {
    if (!usedCurrent.has(index)) {
      added.push(med);
    }
  }

  return {
    added,
    removed,
    unchanged,
    notes: "",
  };
}
