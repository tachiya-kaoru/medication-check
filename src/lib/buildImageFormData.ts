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

function appendImageList(
  form: FormData,
  fieldPrefix: string,
  countField: string,
  images: AnalyzeRequestImage[]
) {
  form.append(countField, String(images.length));
  images.forEach((image, index) => {
    form.append(
      `${fieldPrefix}_${index}`,
      analyzeImageToBlob(image),
      `${fieldPrefix}-${index}.jpg`
    );
  });
}

export function buildAnalyzeFormData(images: AnalyzeRequestImage[]): FormData {
  const form = new FormData();
  appendImageList(form, "image", "imageCount", images);
  return form;
}

export function buildCompareFormData(input: {
  currentImages: AnalyzeRequestImage[];
  previousImages?: AnalyzeRequestImage[];
  previousMedications?: unknown[];
}): FormData {
  const form = new FormData();
  appendImageList(form, "currentImage", "currentImageCount", input.currentImages);
  appendImageList(
    form,
    "previousImage",
    "previousImageCount",
    input.previousImages ?? []
  );
  if (input.previousMedications && input.previousMedications.length > 0) {
    form.append(
      "previousMedications",
      JSON.stringify(input.previousMedications)
    );
  }
  return form;
}
