"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { AppHeader } from "@/components/AppHeader";
import { MedicationQrPanel } from "@/components/MedicationQrPanel";
import { ensureCompressed, filesToCapturedImages, type CapturedImage } from "@/lib/capturedImage";
import type { AnalyzeResult, MedicationItem } from "@/lib/types";

type AppPhase = "input" | "loading" | "result" | "error";

export default function Home() {
  const [patientNumber, setPatientNumber] = useState("");
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [phase, setPhase] = useState<AppPhase>("input");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      // value を空にすると FileList も消えるため、先に File[] へコピーする
      const files = Array.from(fileList);
      e.target.value = "";

      try {
        const next = await filesToCapturedImages(files);
        setImages((prev) => [...prev, ...next]);
        if (phase === "error") {
          setPhase("input");
          setErrorMessage("");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "画像の読み込みに失敗しました"
        );
        setPhase("error");
      }
    },
    [phase]
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;

    setPhase("loading");
    setErrorMessage("");
    setResult(null);

    try {
      const compressed = await ensureCompressed(images);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: compressed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "解析に失敗しました");
      }

      setResult(data as AnalyzeResult);
      setCreatedAt(new Date());
      setPhase("result");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "予期しないエラーが発生しました"
      );
      setPhase("error");
    }
  }, [images]);

  const handleReset = useCallback(() => {
    setPhase("input");
    setResult(null);
    setCreatedAt(null);
    setErrorMessage("");
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const canSubmit = images.length > 0 && phase !== "loading";

  return (
    <>
      {/* ===== 画面UI（印刷時は非表示） ===== */}
      <main className="no-print min-h-screen bg-slate-50 flex flex-col">
        <AppHeader current="analyze" />

        <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full flex flex-col gap-8">
          {/* 入力フェーズ */}
          {(phase === "input" || phase === "error") && (
            <>
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

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-3 w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-2xl py-5 text-xl font-semibold shadow-md transition-colors select-none"
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
                          alt={`撮影画像 ${index + 1}`}
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

              {phase === "error" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
                  <p className="font-semibold">解析に失敗しました</p>
                  <p className="text-sm mt-1">{errorMessage}</p>
                </div>
              )}

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
            </>
          )}

          {/* 読み込み中 */}
          {phase === "loading" && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
              <p className="text-lg font-semibold text-slate-700">
                AIがお薬情報を読み取っています…
              </p>
              <p className="text-sm text-slate-500 text-center">
                画像はサーバーに保存されません。しばらくお待ちください。
              </p>
            </section>
          )}

          {/* 結果表示 */}
          {phase === "result" && result && (
            <>
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">お薬一覧</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      患者番号：
                      <span className="font-mono font-semibold text-slate-700">
                        {patientNumber || "（未入力）"}
                      </span>
                      {" ／ "}
                      {result.medications.length}件
                    </p>
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xs">
                    AIによる参考情報です。必ず原本と照合してください。
                  </p>
                </div>

                {result.medications.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    薬品名を読み取れませんでした。写真を撮り直してください。
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-sm border-collapse min-w-[520px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="border border-slate-200 px-3 py-2 text-left w-8">#</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">薬品名</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">何の薬か</th>
                          <th className="border border-slate-200 px-3 py-2 text-left">歯科での注意</th>
                          <th className="border border-slate-200 px-3 py-2 text-left w-16">注意</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.medications.map((med, i) => (
                          <tr key={`${med.name}-${i}`} className={rowClass(med.cautionLevel)}>
                            <td className="border border-slate-200 px-3 py-2 text-slate-500">
                              {i + 1}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <div className="font-semibold text-slate-800">{med.name}</div>
                              {med.genericName && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {med.genericName}
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-700">
                              {med.purpose}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-700">
                              {med.dentalNotes}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <CautionBadge level={med.cautionLevel} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {result.notes && (
                  <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <span className="font-semibold">補足：</span>
                    {result.notes}
                  </p>
                )}
              </section>

              <MedicationQrPanel
                medications={result.medications}
                patientNumber={patientNumber}
                createdAt={createdAt}
              />

              <div className="flex flex-col gap-3 pb-8">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full rounded-2xl py-6 text-xl font-bold shadow-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white transition-colors select-none"
                >
                  A4印刷する
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-2xl py-4 text-lg font-semibold border-2 border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors select-none"
                >
                  写真を撮り直す
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ===== 印刷専用レイアウト ===== */}
      {result && (
        <div className="print-only print-sheet">
          <header
            className="print-header"
            style={{
              marginBottom: "12px",
              borderBottom: "2px solid #0f766e",
              paddingBottom: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: "18pt", margin: 0, color: "#0f766e" }}>お薬情報整理表</h1>
              <p style={{ margin: "6px 0 0", fontSize: "11pt" }}>
                患者番号：<strong>{patientNumber || "（未入力）"}</strong>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "11pt" }}>
                作成日：<strong>{createdAt ? formatDateTime(createdAt) : "—"}</strong>
              </p>
            </div>
            <MedicationQrPanel
              medications={result.medications}
              patientNumber={patientNumber}
              createdAt={createdAt}
              compact
            />
          </header>

          {result.medications.length === 0 ? (
            <p>薬品名を読み取れませんでした。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: "6%" }}>#</th>
                  <th style={{ width: "22%" }}>薬品名</th>
                  <th style={{ width: "24%" }}>何の薬か</th>
                  <th style={{ width: "38%" }}>歯科での注意事項</th>
                  <th style={{ width: "10%" }}>注意度</th>
                </tr>
              </thead>
              <tbody>
                {result.medications.map((med, i) => (
                  <tr
                    key={`print-${med.name}-${i}`}
                    className={
                      med.cautionLevel === "high"
                        ? "caution-high"
                        : med.cautionLevel === "medium"
                          ? "caution-medium"
                          : undefined
                    }
                  >
                    <td>{i + 1}</td>
                    <td>
                      <strong>{med.name}</strong>
                      {med.genericName ? (
                        <>
                          <br />
                          <span style={{ fontSize: "9pt", color: "#475569" }}>
                            {med.genericName}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>{med.purpose}</td>
                    <td>{med.dentalNotes}</td>
                    <td>{cautionLabel(med.cautionLevel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.notes && (
            <p style={{ marginTop: "12px", fontSize: "10pt" }}>
              <strong>補足：</strong>
              {result.notes}
            </p>
          )}

          <footer style={{ marginTop: "20px", fontSize: "9pt", color: "#64748b", borderTop: "1px solid #cbd5e1", paddingTop: "8px" }}>
            ※ 本表はAIによる参考情報です。診療判断の前に必ず原本（お薬手帳・処方箋）と照合してください。患者情報は保存していません。右上QRにお薬一覧を格納しています（サーバー保存なし）。
          </footer>
        </div>
      )}
    </>
  );
}

function rowClass(level: MedicationItem["cautionLevel"]) {
  if (level === "high") return "bg-red-50";
  if (level === "medium") return "bg-amber-50/60";
  return "bg-white";
}

function cautionLabel(level: MedicationItem["cautionLevel"]) {
  if (level === "high") return "高";
  if (level === "medium") return "中";
  return "低";
}

function CautionBadge({ level }: { level: MedicationItem["cautionLevel"] }) {
  const styles =
    level === "high"
      ? "bg-red-100 text-red-700"
      : level === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block text-xs font-bold px-2 py-1 rounded-md ${styles}`}>
      {cautionLabel(level)}
    </span>
  );
}

function formatDateTime(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function PhotoPlaceholderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 text-slate-300" aria-hidden="true">
      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
    </svg>
  );
}
