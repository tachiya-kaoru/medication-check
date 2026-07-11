"use client";

import { useRef } from "react";
import Image from "next/image";
import type { CapturedImage } from "@/lib/capturedImage";

export type { CapturedImage };

interface PhotoSectionProps {
  title: string;
  images: CapturedImage[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  accent?: "teal" | "slate" | "indigo";
}

export function PhotoSection({
  title,
  images,
  onAdd,
  onRemove,
  accent = "teal",
}: PhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buttonClass =
    accent === "indigo"
      ? "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
      : accent === "slate"
        ? "bg-slate-700 hover:bg-slate-800 active:bg-slate-900"
        : "bg-teal-600 hover:bg-teal-700 active:bg-teal-800";
  const badgeClass =
    accent === "indigo"
      ? "text-indigo-600 bg-indigo-50"
      : accent === "slate"
        ? "text-slate-600 bg-slate-100"
        : "text-teal-600 bg-teal-50";

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-700">{title}</h2>
        {images.length > 0 && (
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${badgeClass}`}>
            {images.length}枚
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) {
            // value クリアで FileList が空になる前にコピーする
            onAdd(Array.from(fileList));
          }
          e.target.value = "";
        }}
        className="hidden"
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center justify-center gap-3 w-full text-white rounded-2xl py-5 text-xl font-semibold shadow-md transition-colors select-none ${buttonClass}`}
      >
        <CameraIcon />
        写真を追加する
      </button>

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((img, index) => (
            <li
              key={img.id}
              className="relative rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm aspect-[3/4] bg-slate-100"
            >
              <Image
                src={img.dataUrl}
                alt={`${title} ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 33vw"
                unoptimized
              />
              <span className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                aria-label={`画像 ${index + 1} を削除`}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow transition-colors"
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-sm">写真がまだありません</p>
        </div>
      )}
    </section>
  );
}

function CameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 1 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
    </svg>
  );
}
