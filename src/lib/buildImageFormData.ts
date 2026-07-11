import type { AnalyzeRequestImage } from "@/lib/types";

/** base64 画像をバイナリ Blob に戻す（JSON送信より軽量な multipart 用） */
export function analyzeImageToBlob(image: AnalyzeRequestImage): Blob {
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: image.mimeType || "image/jpeg" });
}

export function buildAnalyzeFormData(images: AnalyzeRequestImage[]): FormData {
  const form = new FormData();
  images.forEach((image, index) => {
    form.append("images", analyzeImageToBlob(image), `image-${index}.jpg`);
  });
  return form;
}

export function buildCompareFormData(input: {
  currentImages: AnalyzeRequestImage[];
  previousImages?: AnalyzeRequestImage[];
  previousMedications?: unknown[];
}): FormData {
  const form = new FormData();
  input.currentImages.forEach((image, index) => {
    form.append(
      "currentImages",
      analyzeImageToBlob(image),
      `current-${index}.jpg`
    );
  });
  (input.previousImages ?? []).forEach((image, index) => {
    form.append(
      "previousImages",
      analyzeImageToBlob(image),
      `previous-${index}.jpg`
    );
  });
  if (input.previousMedications && input.previousMedications.length > 0) {
    form.append(
      "previousMedications",
      JSON.stringify(input.previousMedications)
    );
  }
  return form;
}
