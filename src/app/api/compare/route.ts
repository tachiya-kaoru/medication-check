import { NextRequest, NextResponse } from "next/server";
import { diffMedicationsLocally } from "@/lib/diffMedications";
import { extractMedicationsFromImages } from "@/lib/medicationAi";
import { filesFromFormData } from "@/lib/parseUploadedImages";
import type { AnalyzeRequestImage, CompareResult, MedicationItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

async function readComparePayload(req: NextRequest): Promise<{
  previousImages: AnalyzeRequestImage[];
  previousMedications: MedicationItem[];
  currentImages: AnalyzeRequestImage[];
}> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const previousMedicationsRaw = formData.get("previousMedications");
    let previousMedications: MedicationItem[] = [];
    if (typeof previousMedicationsRaw === "string" && previousMedicationsRaw) {
      previousMedications = JSON.parse(previousMedicationsRaw) as MedicationItem[];
    }
    return {
      previousImages: await filesFromFormData(formData, "previousImages"),
      previousMedications,
      currentImages: await filesFromFormData(formData, "currentImages"),
    };
  }

  const body = (await req.json()) as {
    previousImages?: AnalyzeRequestImage[];
    previousMedications?: MedicationItem[];
    currentImages?: AnalyzeRequestImage[];
  };
  return {
    previousImages: body.previousImages ?? [],
    previousMedications: body.previousMedications ?? [],
    currentImages: body.currentImages ?? [],
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 }
    );
  }

  let previousImages: AnalyzeRequestImage[];
  let previousMedications: MedicationItem[];
  let currentImages: AnalyzeRequestImage[];
  try {
    ({ previousImages, previousMedications, currentImages } =
      await readComparePayload(req));
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

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
