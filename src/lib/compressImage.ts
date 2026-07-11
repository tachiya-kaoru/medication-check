/** タブレット写真をAPI送信用に縮小・JPEG圧縮する（送信・AI処理の高速化） */
export async function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 1024,
  quality = 0.58
): Promise<{ mimeType: string; data: string }> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas が利用できません");

  ctx.drawImage(img, 0, 0, width, height);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
  const [, data = ""] = jpegDataUrl.split(",");
  return { mimeType: "image/jpeg", data };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = src;
  });
}
