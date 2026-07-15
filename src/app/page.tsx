"use client";

import { useState, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LoadingPanel, type LoadingStep } from "@/components/LoadingPanel";
import { MedicationQrPanel } from "@/components/MedicationQrPanel";
import { PhotoSection } from "@/components/PhotoSection";
import { buildAnalyzeFormData } from "@/lib/buildImageFormData";
import { ensureCompressed, filesToCapturedImages, type CapturedImage } from "@/lib/capturedImage";
import { formatDate } from "@/lib/formatDate";
import type { AnalyzeResult, MedicationItem } from "@/lib/types";

type AppPhase = "input" | "loading" | "result" | "error";

async function addFiles(
  files: File[],
  setter: React.Dispatch<React.SetStateAction<CapturedImage[]>>
) {
  const next = await filesToCapturedImages(files);
  setter((prev) => [...prev, ...next]);
}

export default function Home() {
  const [patientNumber, setPatientNumber] = useState("");
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [phase, setPhase] = useState<AppPhase>("input");
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("preparing");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;

    setPhase("loading");
    setLoadingStep("preparing");
    setErrorMessage("");
    setResult(null);

    try {
      const compressed = await ensureCompressed(images);
      setLoadingStep("uploading");

      const analyzeTimer = window.setTimeout(() => {
        setLoadingStep("analyzing");
      }, 1200);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          body: buildAnalyzeFormData(compressed),
        });
        setLoadingStep("analyzing");

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "解析に失敗しました");
        }

        setResult(data as AnalyzeResult);
        setCreatedAt(new Date());
        setPhase("result");
      } finally {
        window.clearTimeout(analyzeTimer);
      }
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

              <PhotoSection
                title="お薬手帳・処方箋の写真"
                images={images}
                onAdd={(files) => {
                  void addFiles(files, setImages)
                    .then(() => {
                      if (phase === "error") {
                        setPhase("input");
                        setErrorMessage("");
                      }
                    })
                    .catch((err) => {
                      setErrorMessage(
                        err instanceof Error
                          ? err.message
                          : "画像の読み込みに失敗しました"
                      );
                      setPhase("error");
                    });
                }}
                onRemove={handleRemoveImage}
                accent="teal"
              />

              {images.length === 1 && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  読み取りにくい写真のときは、別角度や別ページをもう1枚追加すると漏れが減ります。
                </p>
              )}

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

          {phase === "loading" && (
            <LoadingPanel mode="analyze" step={loadingStep} />
          )}

          {/* 結果表示 */}
          {phase === "result" && result && (
            <>
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">お薬一覧</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      作成日：
                      <span className="font-semibold text-slate-700">
                        {createdAt ? formatDate(createdAt) : "—"}
                      </span>
                      {" ／ "}
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
                作成日：<strong>{createdAt ? formatDate(createdAt) : "—"}</strong>
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
