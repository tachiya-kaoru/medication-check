import { NextRequest, NextResponse } from "next/server";
import { diffMedicationsLocally } from "@/lib/diffMedications";
import { extractMedicationsFromImages } from "@/lib/medicationAi";
import type { AnalyzeRequestImage, CompareResult, MedicationItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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
        error: "前回は写真またはQR、今回は写真を1枚以上用意してください",
      },
      { status: 400 }
    );
  }
  if (previousImages.length + currentImages.length > 16) {
    return NextResponse.json({ error: "写真は合計16枚までです" }, { status: 400 });
  }

  try {
    // 抽出はお薬表と同じAI（正確性）。差分だけローカル処理（高速）。
    const previousPromise = hasPreviousFromQr
      ? Promise.resolve({
          medications: previousMedications,
          notes: "",
        })
      : extractMedicationsFromImages(apiKey, previousImages, "前回のお薬手帳");

    const currentPromise = extractMedicationsFromImages(
      apiKey,
      currentImages,
      "今回のお薬手帳"
    );

    const [previousResult, currentResult] = await Promise.all([
      previousPromise,
      currentPromise,
    ]);

    const diff = diffMedicationsLocally(
      previousResult.medications,
      currentResult.medications
    );

    const notes = [previousResult.notes, currentResult.notes]
      .filter(Boolean)
      .join(" ／ ");

    const parsed: CompareResult = {
      ...diff,
      notes,
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
