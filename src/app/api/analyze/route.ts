import { NextRequest, NextResponse } from "next/server";
import { extractMedicationsFromImages } from "@/lib/medicationAi";
import { filesFromFormData } from "@/lib/parseUploadedImages";
import type { AnalyzeRequestImage, AnalyzeResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readImages(req: NextRequest): Promise<AnalyzeRequestImage[]> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    return filesFromFormData(formData, "images");
  }

  const body = (await req.json()) as { images?: AnalyzeRequestImage[] };
  return body.images ?? [];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 }
    );
  }

  let images: AnalyzeRequestImage[];
  try {
    images = await readImages(req);
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  if (images.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }
  if (images.length > 12) {
    return NextResponse.json({ error: "画像は最大12枚までです" }, { status: 400 });
  }

  try {
    const parsed: AnalyzeResult = await extractMedicationsFromImages(apiKey, images);
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
