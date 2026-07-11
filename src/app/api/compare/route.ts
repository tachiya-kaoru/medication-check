import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { parseMedicationList, stripJsonFence } from "@/lib/parseMedications";
import type { AnalyzeRequestImage, CompareResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM_PROMPT = `あなたは歯科医院向けの薬剤情報比較アシスタントです。
「前回」と「今回」のお薬手帳・処方箋などの写真を比較し、増えた薬・消えた薬・継続中の薬を整理してください。

【厳守ルール】
- 写真に写っている薬品のみを対象にする（推測で追加しない）
- 同一成分・同一薬の表記ゆれ（商品名/一般名、剤形の軽微な違い）は同じ薬として扱う
- 用量・用法だけの変更は「継続（unchanged）」とし、notes に「用量変更の可能性」と書く
- 歯科での注意事項は、出血傾向・骨壊死リスク・相互作用・麻酔・抜歯等の観点で簡潔に
- 不明な点は dentalNotes に「要確認」と書く
- 患者の個人情報は出力しない

【cautionLevel】
- high: 抜歯・外科で特に注意（抗凝固薬、ビスホスホネート系等）
- medium: 注意が必要だが通常は管理可能
- low: 歯科処置への影響が小さい

必ず次のJSON形式のみで返答してください（説明文やMarkdownは不要）:
{
  "added": [
    {
      "name": "薬品名",
      "genericName": "一般名（不明なら空文字）",
      "purpose": "何の薬か",
      "dentalNotes": "歯科での注意事項",
      "cautionLevel": "low" | "medium" | "high"
    }
  ],
  "removed": [ /* 前回にあって今回にない薬。同じ形式 */ ],
  "unchanged": [ /* 両方にある薬。同じ形式 */ ],
  "notes": "全体への補足（なければ空文字）"
}`;

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
    currentImages?: AnalyzeRequestImage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const previousImages = body.previousImages ?? [];
  const currentImages = body.currentImages ?? [];

  if (previousImages.length === 0 || currentImages.length === 0) {
    return NextResponse.json(
      { error: "前回・今回の写真をそれぞれ1枚以上追加してください" },
      { status: 400 }
    );
  }
  if (previousImages.length + currentImages.length > 16) {
    return NextResponse.json({ error: "写真は合計16枚までです" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts: ImagePart[] = [
      { text: SYSTEM_PROMPT },
      { text: `【前回のお薬手帳】写真 ${previousImages.length} 枚` },
      ...toInlineParts(previousImages),
      { text: `【今回のお薬手帳】写真 ${currentImages.length} 枚。前回と比較して増減を整理してください。` },
      ...toInlineParts(currentImages),
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const text = response.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "AIから応答がありませんでした。もう一度お試しください。" },
        { status: 502 }
      );
    }

    const parsed = parseCompareResult(text);
    return NextResponse.json(parsed satisfies CompareResult);
  } catch (err) {
    console.error("[compare]", err);
    const message =
      err instanceof Error ? err.message : "比較中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
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

function parseCompareResult(text: string): CompareResult {
  const raw = JSON.parse(stripJsonFence(text)) as {
    added?: unknown;
    removed?: unknown;
    unchanged?: unknown;
    notes?: unknown;
  };

  return {
    added: parseMedicationList(raw.added),
    removed: parseMedicationList(raw.removed),
    unchanged: parseMedicationList(raw.unchanged),
    notes: String(raw.notes ?? "").trim(),
  };
}
