"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";

interface CapturedImage {
  id: string;
  dataUrl: string;
  fileName: string;
}

export default function Home() {
  const [patientNumber, setPatientNumber] = useState("");
  const [images, setImages] = useState<CapturedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setImages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              dataUrl,
              fileName: file.name,
            },
          ]);
        };
        reader.readAsDataURL(file);
      });

      // 同じファイルを再選択できるようにリセット
      e.target.value = "";
    },
    []
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleSubmit = useCallback(() => {
    console.log("=== お薬表作成リクエスト ===");
    console.log("患者番号:", patientNumber || "（未入力）");
    console.log("画像枚数:", images.length);
    images.forEach((img, i) => {
      console.log(`  画像 ${i + 1}: ${img.fileName} (${img.dataUrl.length} bytes)`);
    });
    console.log("===========================");
  }, [patientNumber, images]);

  const canSubmit = images.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-teal-700 tracking-wide">
          お薬情報整理
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">院内専用システム</p>
      </header>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full flex flex-col gap-8">

        {/* ① 患者番号入力 */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <label
            htmlFor="patientNumber"
            className="block text-base font-semibold text-slate-700 mb-3"
          >
            患者番号
          </label>
          <input
            id="patientNumber"
            type="text"
            inputMode="numeric"
            placeholder="例：12345"
            value={patientNumber}
            onChange={(e) => setPatientNumber(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-300 focus:border-teal-500 focus:outline-none px-4 py-4 text-2xl font-mono tracking-widest text-slate-800 placeholder:text-slate-300 transition-colors"
          />
        </section>

        {/* ② 撮影ボタン + サムネイル */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">
              お薬手帳・処方箋の写真
            </h2>
            {images.length > 0 && (
              <span className="text-sm text-teal-600 font-medium bg-teal-50 px-3 py-1 rounded-full">
                {images.length}枚
              </span>
            )}
          </div>

          {/* 隠しファイルinput（カメラ＆ライブラリ両対応） */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* 撮影ボタン */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-3 w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-2xl py-5 text-xl font-semibold shadow-md transition-colors select-none"
          >
            <CameraIcon />
            写真を追加する
          </button>

          {/* サムネイル一覧 */}
          {images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((img, index) => (
                <li
                  key={img.id}
                  className="relative rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm aspect-[3/4] bg-slate-100"
                >
                  <Image
                    src={img.dataUrl}
                    alt={`撮影画像 ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                  {/* 枚数バッジ */}
                  <span className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {index + 1}
                  </span>
                  {/* 削除ボタン */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    aria-label={`画像 ${index + 1} を削除`}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <PhotoPlaceholderIcon />
              <p className="mt-3 text-sm">写真がまだありません</p>
              <p className="text-xs mt-1">上のボタンから追加してください</p>
            </div>
          )}
        </section>

        {/* ③ 送信ボタン */}
        <div className="pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full rounded-2xl py-6 text-xl font-bold shadow-lg transition-all select-none ${
              canSubmit
                ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            この内容でお薬表を作成する
          </button>
          {!canSubmit && (
            <p className="text-center text-sm text-slate-400 mt-2">
              写真を1枚以上追加してください
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

/* ---- アイコンコンポーネント ---- */

function CameraIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-7 h-7"
      aria-hidden="true"
    >
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path
        fillRule="evenodd"
        d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PhotoPlaceholderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-14 h-14 text-slate-300"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
