import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { formatDentalCautionListForPrompt } from "@/lib/dentalCautionList";
import {
  GEMINI_MODEL,
  analyzeResponseSchema,
  buildGeminiConfig,
} from "@/lib/geminiConfig";
import { parseJsonObject, parseMedicationList } from "@/lib/parseMedications";
import type { AnalyzeRequestImage, AnalyzeResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystemPrompt(): string {
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 }
    );
  }

  let body: { images?: AnalyzeRequestImage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const images = body.images ?? [];
  if (images.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }
  if (images.length > 12) {
    return NextResponse.json({ error: "画像は最大12枚までです" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: buildSystemPrompt() },
      { text: `以下はお薬関連の写真 ${images.length} 枚です。写っている薬品名をすべて抽出し、1剤も落とさないでください。` },
    ];

    for (const image of images) {
      if (!image.data || !image.mimeType) continue;
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: buildGeminiConfig(analyzeResponseSchema),
    });

    const text = response.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "AIから応答がありませんでした。もう一度お試しください。" },
        { status: 502 }
      );
    }

    const raw = parseJsonObject(text);
    const parsed: AnalyzeResult = {
      medications: parseMedicationList(raw.medications),
      notes: String(raw.notes ?? "").trim(),
    };
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[analyze]", err);
    const message =
      err instanceof Error ? err.message : "解析中にエラーが発生しました";
    const userMessage =
      /JSON|応答形式/i.test(message)
        ? "AIの応答形式が不正でした。もう一度お試しください。"
        : message;
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
