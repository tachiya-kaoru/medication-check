import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeRequestImage, AnalyzeResult, MedicationItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたは歯科医院向けの薬剤情報整理アシスタントです。
お薬手帳・処方箋・薬袋などの写真から薬品名をすべて抽出し、歯科診療で必要な注意点をまとめてください。

【厳守ルール】
- 写真に写っている薬品のみを列挙する（推測で追加しない）
- 同じ薬が複数枚に写っている場合は1件にまとめる
- 読み取れない文字は無理に補完せず、読めた範囲で記載する
- 歯科での注意事項は、出血傾向・骨壊死リスク・相互作用・麻酔・抜歯・インプラント等の観点で簡潔に書く
- 不明な点は dentalNotes に「要確認」と明記する
- 患者の個人情報（氏名・住所など）は出力しない

【cautionLevel】
- high: 抜歯・外科処置で特に注意（抗凝固薬、ビスホスホネート系、高用量ステロイド等）
- medium: 注意が必要だが通常は管理可能
- low: 歯科処置への影響が小さい、または特記事項なし

必ず次のJSON形式のみで返答してください（説明文やMarkdownは不要）:
{
  "medications": [
    {
      "name": "薬品名（商品名）",
      "genericName": "一般名（不明なら空文字）",
      "purpose": "何の薬か（効能・用途を短く）",
      "dentalNotes": "歯科での注意事項",
      "cautionLevel": "low" | "medium" | "high"
    }
  ],
  "notes": "全体への補足（読み取り困難だった点など。なければ空文字）"
}`;

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
      { text: SYSTEM_PROMPT },
      { text: `以下はお薬関連の写真 ${images.length} 枚です。薬品を抽出してください。` },
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

    const parsed = parseAnalyzeResult(text);
    return NextResponse.json(parsed satisfies AnalyzeResult);
  } catch (err) {
    console.error("[analyze]", err);
    const message =
      err instanceof Error ? err.message : "解析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseAnalyzeResult(text: string): AnalyzeResult {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const raw = JSON.parse(cleaned) as {
    medications?: unknown[];
    notes?: unknown;
  };

  const medications: MedicationItem[] = (raw.medications ?? [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? "").trim() || "（名称不明）",
      genericName: String(item.genericName ?? "").trim(),
      purpose: String(item.purpose ?? "").trim() || "—",
      dentalNotes: String(item.dentalNotes ?? "").trim() || "—",
      cautionLevel: normalizeCaution(item.cautionLevel),
    }));

  return {
    medications,
    notes: String(raw.notes ?? "").trim(),
  };
}

function normalizeCaution(value: unknown): MedicationItem["cautionLevel"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}
