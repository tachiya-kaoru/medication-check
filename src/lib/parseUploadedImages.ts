import type { AnalyzeRequestImage } from "@/lib/types";

async function blobToAnalyzeImage(blob: Blob): Promise<AnalyzeRequestImage> {
  if (blob.size <= 0) {
    throw new Error("空の画像ファイルが含まれています");
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  return {
    mimeType: blob.type || "image/jpeg",
    data: buffer.toString("base64"),
  };
}

function readCount(formData: FormData, fieldName: string): number | null {
  const raw = formData.get(fieldName);
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * インデックス付きフィールド（例: image_0, image_1）から画像を復元する。
 * 同名フィールドの getAll 欠落を避け、枚数不一致も検出する。
 */
export async function indexedImagesFromFormData(
  formData: FormData,
  fieldPrefix: string,
  countField: string
): Promise<AnalyzeRequestImage[]> {
  const expected = readCount(formData, countField);
  const images: AnalyzeRequestImage[] = [];

  for (let index = 0; ; index += 1) {
    const entry = formData.get(`${fieldPrefix}_${index}`);
    if (entry == null) break;
    if (typeof entry === "string" || typeof (entry as Blob).arrayBuffer !== "function") {
      throw new Error(`${fieldPrefix}_${index} の形式が不正です`);
    }
    images.push(await blobToAnalyzeImage(entry as Blob));
  }

  if (expected != null && images.length !== expected) {
    throw new Error(
      `画像枚数が一致しません（${fieldPrefix}: 送信${expected}枚 / 受信${images.length}枚）`
    );
  }

  return images;
}

/** @deprecated 互換用。新規は indexedImagesFromFormData を使う */
export async function filesFromFormData(
  formData: FormData,
  fieldName: string
): Promise<AnalyzeRequestImage[]> {
  const entries = formData.getAll(fieldName);
  const blobs = entries.filter(
    (entry): entry is Blob =>
      typeof entry !== "string" &&
      typeof Blob !== "undefined" &&
      entry instanceof Blob &&
      entry.size > 0
  );
  return Promise.all(blobs.map(blobToAnalyzeImage));
}
