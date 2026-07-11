import dentalCautionDrugs from "@/data/dentalCautionDrugs.json";

export interface DentalCautionDrug {
  keywords: string[];
  note: string;
  cautionLevel: "low" | "medium" | "high";
}

/** プロンプトに埋め込む院内の歯科注意薬リスト（後から JSON を編集して拡充） */
export function formatDentalCautionListForPrompt(): string {
  const list = dentalCautionDrugs as DentalCautionDrug[];
  if (!list.length) {
    return "（リスト未登録。歯科処置で特記すべき注意がある薬のみ dentalNotes を記載し、それ以外は空文字にする）";
  }

  return list
    .map((item, i) => {
      const keys = item.keywords.join(" / ");
      return `${i + 1}. キーワード: ${keys}\n   注意: ${item.note}\n   cautionLevel目安: ${item.cautionLevel}`;
    })
    .join("\n");
}
