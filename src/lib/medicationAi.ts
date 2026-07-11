import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { formatDentalCautionListForPrompt } from "@/lib/dentalCautionList";
import { normalizeDrugKey } from "@/lib/diffMedications";
import {
  GEMINI_MODEL,
  analyzeResponseSchema,
  buildGeminiConfig,
} from "@/lib/geminiConfig";
import { parseJsonObject, parseMedicationList } from "@/lib/parseMedications";
import type {
  AnalyzeRequestImage,
  AnalyzeResult,
  MedicationItem,
} from "@/lib/types";

type ImagePart = { text: string } | { inlineData: { mimeType: string; data: string } };

function buildExtractPrompt(): string {
  return `あなたは歯科医院向けの薬剤情報整理アシスタントです。
お薬手帳・処方箋・薬袋などの写真から薬品名をすべて抽出し、歯科診療で必要な注意点をまとめてください。

【厳守ルール】
- 写真に写っている薬品をすべて列挙する（1剤でも落とさない。これが最優先）
- 推測で存在しない薬を追加しない
- 同じ薬が複数枚・複数行に写っている場合は1件にまとめる
- 外用薬・頓服・漢方・点眼・貼付剤も、名前が読めるものは必ず含める
- dentalNotes が空でも、薬品名の行自体は必ず medications に残す（注意なし＝行を消す、ではない）
- 読み取れない文字は無理に補完せず、読めた範囲で記載する。一部でも読めたら載せる
- 患者の個人情報（氏名・住所など）は出力しない
- 見落としがないか、出力前に写真内の薬品数と medications の件数を照合する
- 読み取りが不完全な可能性がある場合は notes にその旨を書く

【dentalNotes（歯科での注意）の書き方】
- 歯科処置（抜歯・外科・出血・顎骨壊死・感染・麻酔など）で特記すべき注意がある薬だけ書く
- 特記すべき注意がない薬は dentalNotes を空文字 "" にする（「特になし」「なし」等も書かない）
- 判断できない場合のみ「要確認」と書く（空欄にしない）
- 下の【院内 歯科注意薬リスト】にキーワードが一致／類似する薬は、リストの注意文を優先して使う

【cautionLevel】
- high: 抜歯・外科で特に注意（抗凝固薬、骨吸収抑制薬など）
- medium: 注意はあるが通常は管理可能
- low: 歯科での特記事項なし（dentalNotes が空のときは原則 low）

【院内 歯科注意薬リスト】
${formatDentalCautionListForPrompt()}

JSONで medications と notes を返してください。`;
}

function toInlineParts(images: AnalyzeRequestImage[]): ImagePart[] {
  return images
    .filter((image) => image.data && image.mimeType)
    .map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    }));
}

function medicationKeys(med: MedicationItem): string[] {
  return [med.name, med.genericName]
    .map((t) => normalizeDrugKey(t))
    .filter((t) => t.length >= 2);
}

function isSameMedication(a: MedicationItem, b: MedicationItem): boolean {
  const aKeys = medicationKeys(a);
  const bKeys = medicationKeys(b);
  if (aKeys.length === 0 || bKeys.length === 0) return false;
  for (const ak of aKeys) {
    for (const bk of bKeys) {
      if (ak === bk) return true;
      const shorter = ak.length <= bk.length ? ak : bk;
      const longer = ak.length <= bk.length ? bk : ak;
      if (shorter.length >= 3 && longer.includes(shorter)) return true;
    }
  }
  return false;
}

/** 2回の抽出結果を和集合で統合（漏れ補完用） */
export function mergeMedicationResults(
  primary: AnalyzeResult,
  secondary: AnalyzeResult
): AnalyzeResult {
  const merged = [...primary.medications];
  for (const med of secondary.medications) {
    if (!merged.some((existing) => isSameMedication(existing, med))) {
      merged.push(med);
    }
  }
  const notes = [primary.notes, secondary.notes].filter(Boolean).join(" ／ ");
  return { medications: merged, notes };
}

async function extractOnce(
  ai: GoogleGenAI,
  images: AnalyzeRequestImage[],
  extraTexts: string[],
  thinkingLevel: ThinkingLevel
): Promise<AnalyzeResult> {
  const parts: ImagePart[] = [
    { text: buildExtractPrompt() },
    ...extraTexts.map((text) => ({ text })),
    ...toInlineParts(images),
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: buildGeminiConfig(analyzeResponseSchema, { thinkingLevel }),
  });

  const text = response.text?.trim() ?? "";
  if (!text) {
    throw new Error("AIから応答がありませんでした。もう一度お試しください。");
  }

  const raw = parseJsonObject(text);
  return {
    medications: parseMedicationList(raw.medications),
    notes: String(raw.notes ?? "").trim(),
  };
}

/**
 * お薬表作成と同じ抽出ロジック（写真 → 薬品リスト）。
 * 1枚のときは見落としやすいので、再読取して結果を統合する。
 */
export async function extractMedicationsFromImages(
  apiKey: string,
  images: AnalyzeRequestImage[],
  label = "お薬関連"
): Promise<AnalyzeResult> {
  const ai = new GoogleGenAI({ apiKey });
  const singleImage = images.length === 1;
  const thinkingLevel = singleImage ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;

  const first = await extractOnce(
    ai,
    images,
    [
      `以下は${label}の写真 ${images.length} 枚です。写っている薬品名をすべて抽出し、1剤も落とさないでください。`,
      ...(singleImage
        ? [
            "写真は1枚のみです。行の端・小さい字・かすれ・反射で読みにくい薬品も、読める範囲ですべて列挙してください。",
          ]
        : []),
    ],
    thinkingLevel
  );

  if (!singleImage) {
    return first;
  }

  // 読みにくい1枚対策: 別視点で再抽出し、和集合で漏れを補う
  const firstNames = first.medications
    .map((m) => m.name)
    .filter(Boolean)
    .join("、");

  const second = await extractOnce(
    ai,
    images,
    [
      `以下は${label}の写真1枚の再確認です。1回目の結果に漏れがないか、写真を最初から見直し、完全な薬品リストを返してください。`,
      `1回目で抽出した薬品名: ${firstNames || "（なし）"}`,
      "1回目の薬は残しつつ、漏れていた薬を必ず追加した最終リストにしてください。存在しない薬は追加しないでください。",
    ],
    ThinkingLevel.LOW
  );

  return mergeMedicationResults(first, second);
}
