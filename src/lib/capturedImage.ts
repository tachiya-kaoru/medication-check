import { compressImageDataUrl } from "@/lib/compressImage";
import type { AnalyzeRequestImage } from "@/lib/types";

export interface CapturedImage {
  id: string;
  dataUrl: string;
  fileName: string;
  /** 撮影直後に用意する送信用データ（なければ送信時に圧縮） */
  compressed?: AnalyzeRequestImage;
}

/** ファイル選択／撮影後にプレビュー用＋送信用をまとめて作る */
export async function filesToCapturedImages(files: FileList | File[]): Promise<CapturedImage[]> {
  const list = Array.from(files);
  return Promise.all(
    list.map(async (file) => {
      const dataUrl = await readFileAsDataUrl(file);
      const compressed = await compressImageDataUrl(dataUrl);
      return {
        id: `${Date.now()}-${Math.random()}`,
        dataUrl,
        fileName: file.name,
        compressed,
      };
    })
  );
}

export async function ensureCompressed(
  images: CapturedImage[]
): Promise<AnalyzeRequestImage[]> {
  return Promise.all(
    images.map(async (img) => {
      if (img.compressed?.data && img.compressed.mimeType) {
        return img.compressed;
      }
      return compressImageDataUrl(img.dataUrl);
    })
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}
