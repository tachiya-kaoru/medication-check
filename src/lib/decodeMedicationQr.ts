import jsQR from "jsqr";
import {
  decodeQrPayload,
  payloadToMedications,
  type MedicationQrPayload,
} from "@/lib/medicationQr";
import type { MedicationItem } from "@/lib/types";

export interface DecodedMedicationQr {
  payload: MedicationQrPayload;
  medications: MedicationItem[];
}

/** カメラ映像や静止画のピクセルからお薬QRを復元する */
export function decodeMedicationQrFromImageData(
  imageData: ImageData
): DecodedMedicationQr | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  if (!code?.data) return null;

  try {
    const payload = decodeQrPayload(code.data);
    return {
      payload,
      medications: payloadToMedications(payload),
    };
  } catch {
    throw new Error(
      "このQRには対応していません。印刷したお薬表のQRをかざしてください。"
    );
  }
}

/** 撮影／選択したQR画像からお薬データを復元する */
export async function decodeMedicationQrFromFile(
  file: File
): Promise<DecodedMedicationQr> {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("画像を処理できませんでした");

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = decodeMedicationQrFromImageData(imageData);

  if (!decoded) {
    throw new Error("QRコードを読み取れませんでした。もう一度撮影してください。");
  }

  return decoded;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = src;
  });
}
