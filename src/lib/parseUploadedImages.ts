import type { AnalyzeRequestImage } from "@/lib/types";

async function fileToAnalyzeImage(file: File): Promise<AnalyzeRequestImage> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    mimeType: file.type || "image/jpeg",
    data: buffer.toString("base64"),
  };
}

export async function filesFromFormData(
  formData: FormData,
  fieldName: string
): Promise<AnalyzeRequestImage[]> {
  const entries = formData.getAll(fieldName);
  const files = entries.filter((entry): entry is File => entry instanceof File);
  return Promise.all(files.map(fileToAnalyzeImage));
}
