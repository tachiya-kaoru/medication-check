import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { formatDentalCautionListForPrompt } from "@/lib/dentalCautionList";
import {
  GEMINI_MODEL,
  buildGeminiConfig,
  compareResponseSchema,
} from "@/lib/geminiConfig";
import { parseJsonObject, parseMedicationList } from "@/lib/parseMedications";
import type { AnalyzeRequestImage, CompareResult, MedicationItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

function buildSystemPrompt(): string {
  return `あなたは歯科医院向けの薬剤情報比較アシスタントです。
「前回」と「今回」のお薬情報を比較し、増えた薬・消えた薬・継続中の薬を整理してください。
前回は写真、またはQRから復元した薬品リストのどちらかで渡されます。

【厳守ルール】
- 前回・今回それぞれ、渡された薬品をすべて対象にする（1剤でも落とさない。最優先）
- 推測で存在しない薬を追加しない
- 同一成分・同一薬の表記ゆれ（商品名/一般名、剤形の軽微な違い）は同じ薬として扱う
- 外用薬・頓服・漢方・点眼・貼付剤も、名前が読めるものは必ず含める
- dentalNotes が空でも、薬の行自体は added / removed / unchanged のいずれかに残す
- 用量・用法だけの変更は「継続（unchanged）」とし、notes に「用量変更の可能性」と書く
- 患者の個人情報は出力しない
- 出力前に、前回・今回それぞれの薬品数と結果件数を照合し、見落としがないか確認する
- 読み取りが不完全な可能性がある場合は notes にその旨を書く

【dentalNotes（歯科での注意）の書き方】
- 歯科処置で特記すべき注意がある薬だけ書く
- 特記すべき注意がない薬は dentalNotes を空文字 "" にする
- 判断できない場合のみ「要確認」と書く
- 下の【院内 歯科注意薬リスト】に一致／類似する薬は、リストの注意文を優先して使う

【cautionLevel】
- high: 抜歯・外科で特に注意
- medium: 注意はあるが通常は管理可能
- low: 特記事項なし（dentalNotes が空のときは原則 low）

【院内 歯科注意薬リスト】
${formatDentalCautionListForPrompt()}

JSONで added / removed / unchanged / notes を返してください。`;
}

type ImagePart = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 }
    );
  }

  let body: {
    previousImages?: AnalyzeRequestImage[];
    previousMedications?: MedicationItem[];
    currentImages?: AnalyzeRequestImage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const previousImages = body.previousImages ?? [];
  const previousMedications = body.previousMedications ?? [];
  const currentImages = body.currentImages ?? [];
  const hasPreviousFromQr = previousMedications.length > 0;
  const hasPreviousFromPhotos = previousImages.length > 0;

  if ((!hasPreviousFromQr && !hasPreviousFromPhotos) || currentImages.length === 0) {
    return NextResponse.json(
      {
        error:
          "前回は写真またはQR、今回は写真を1枚以上用意してください",
      },
      { status: 400 }
    );
  }
  if (previousImages.length + currentImages.length > 16) {
    return NextResponse.json({ error: "写真は合計16枚までです" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts: ImagePart[] = [{ text: buildSystemPrompt() }];

    if (hasPreviousFromQr) {
      parts.push({
        text: `【前回のお薬一覧（印刷QRから復元・写真ではない）】\n${JSON.stringify(
          previousMedications.map((m) => ({
            name: m.name,
            genericName: m.genericName,
            purpose: m.purpose,
            dentalNotes: m.dentalNotes,
            cautionLevel: m.cautionLevel,
          })),
          null,
          2
        )}`,
      });
    } else {
      parts.push({ text: `【前回のお薬手帳】写真 ${previousImages.length} 枚` });
      parts.push(...toInlineParts(previousImages));
    }

    parts.push({
      text: `【今回のお薬手帳】写真 ${currentImages.length} 枚。前回・今回とも薬品をすべて拾い、1剤も落とさず増減を整理してください。`,
    });
    parts.push(...toInlineParts(currentImages));

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: buildGeminiConfig(compareResponseSchema),
    });

    const text = response.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "AIから応答がありませんでした。もう一度お試しください。" },
        { status: 502 }
      );
    }

    const raw = parseJsonObject(text);
    const parsed: CompareResult = {
      added: parseMedicationList(raw.added),
      removed: parseMedicationList(raw.removed),
      unchanged: parseMedicationList(raw.unchanged),
      notes: String(raw.notes ?? "").trim(),
    };
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[compare]", err);
    const message =
      err instanceof Error ? err.message : "比較中にエラーが発生しました";
    const userMessage =
      /JSON|応答形式/i.test(message)
        ? "AIの応答形式が不正でした。もう一度お試しください。"
        : message;
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
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
