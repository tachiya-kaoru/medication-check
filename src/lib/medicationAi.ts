import { GoogleGenAI } from "@google/genai";
import { formatDentalCautionListForPrompt } from "@/lib/dentalCautionList";
import {
  GEMINI_MODEL,
  analyzeResponseSchema,
  buildGeminiConfig,
} from "@/lib/geminiConfig";
import { parseJsonObject, parseMedicationList } from "@/lib/parseMedications";
import type { AnalyzeRequestImage, AnalyzeResult } from "@/lib/types";

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

/** お薬表作成と同じ抽出ロジック（写真 → 薬品リスト） */
export async function extractMedicationsFromImages(
  apiKey: string,
  images: AnalyzeRequestImage[],
  label = "お薬関連"
): Promise<AnalyzeResult> {
  const ai = new GoogleGenAI({ apiKey });
  const parts: ImagePart[] = [
    { text: buildExtractPrompt() },
    {
      text: `以下は${label}の写真 ${images.length} 枚です。写っている薬品名をすべて抽出し、1剤も落とさないでください。`,
    },
    ...toInlineParts(images),
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: buildGeminiConfig(analyzeResponseSchema),
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
