"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MedicationQrPanel } from "@/components/MedicationQrPanel";
import { PhotoSection } from "@/components/PhotoSection";
import { ensureCompressed, filesToCapturedImages, type CapturedImage } from "@/lib/capturedImage";
import { decodeMedicationQrFromFile } from "@/lib/decodeMedicationQr";
import { currentMedicationsFromCompare } from "@/lib/medicationQr";
import type { CompareResult, MedicationItem } from "@/lib/types";

type AppPhase = "input" | "loading" | "result" | "error";

async function addFiles(
  files: File[],
  setter: React.Dispatch<React.SetStateAction<CapturedImage[]>>
) {
  const next = await filesToCapturedImages(files);
  setter((prev) => [...prev, ...next]);
}

export default function ComparePage() {
  const [patientNumber, setPatientNumber] = useState("");
  const [previousImages, setPreviousImages] = useState<CapturedImage[]>([]);
  const [previousFromQr, setPreviousFromQr] = useState<MedicationItem[] | null>(null);
  const [previousQrLabel, setPreviousQrLabel] = useState("");
  const [currentImages, setCurrentImages] = useState<CapturedImage[]>([]);
  const [phase, setPhase] = useState<AppPhase>("input");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const qrInputRef = useRef<HTMLInputElement>(null);

  const qrMedications = useMemo(
    () => (result ? currentMedicationsFromCompare(result) : []),
    [result]
  );

  const handleQrFile = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    try {
      const decoded = await decodeMedicationQrFromFile(file);
      setPreviousFromQr(decoded.medications);
      setPreviousQrLabel(
        `QR読込 ${decoded.medications.length}件` +
          (decoded.payload.d ? `（${decoded.payload.d}）` : "")
      );
      setPreviousImages([]);
      setPatientNumber((prev) => prev || decoded.payload.p || "");
      setErrorMessage("");
      setPhase((p) => (p === "error" ? "input" : p));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "QRの読み取りに失敗しました");
      setPhase("error");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const hasPrevious = (previousFromQr?.length ?? 0) > 0 || previousImages.length > 0;
    if (!hasPrevious || currentImages.length === 0) return;

    setPhase("loading");
    setErrorMessage("");
    setResult(null);

    try {
      const currCompressed = await ensureCompressed(currentImages);
      const body =
        previousFromQr && previousFromQr.length > 0
          ? {
              previousMedications: previousFromQr,
              currentImages: currCompressed,
            }
          : {
              previousImages: await ensureCompressed(previousImages),
              currentImages: currCompressed,
            };

      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "比較に失敗しました");
      }

      setResult(data as CompareResult);
      setCreatedAt(new Date());
      setPhase("result");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "予期しないエラーが発生しました"
      );
      setPhase("error");
    }
  }, [previousImages, previousFromQr, currentImages]);

  const handleReset = useCallback(() => {
    setPhase("input");
    setResult(null);
    setCreatedAt(null);
    setErrorMessage("");
  }, []);

  const canSubmit =
    ((previousFromQr?.length ?? 0) > 0 || previousImages.length > 0) &&
    currentImages.length > 0 &&
    phase !== "loading";

  return (
    <>
      <main className="no-print min-h-screen bg-slate-50 flex flex-col">
        <AppHeader current="compare" />

        <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full flex flex-col gap-8">
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

              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                <h2 className="text-base font-semibold text-slate-700">① 前回のお薬情報</h2>
                <p className="text-sm text-slate-500">
                  前回印刷した紙のQRを読むか、お薬手帳の写真を追加してください。
                </p>

                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const list = e.target.files;
                    const files = list ? Array.from(list) : [];
                    e.target.value = "";
                    void handleQrFile(files);
                  }}
                />

                <button
                  type="button"
                  onClick={() => qrInputRef.current?.click()}
                  className="w-full rounded-2xl py-4 text-lg font-semibold bg-slate-700 hover:bg-slate-800 text-white transition-colors"
                >
                  前回のQRを読み取る
                </button>

                {previousFromQr && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm flex items-center justify-between gap-3">
                    <span>{previousQrLabel}</span>
                    <button
                      type="button"
                      className="underline shrink-0"
                      onClick={() => {
                        setPreviousFromQr(null);
                        setPreviousQrLabel("");
                      }}
                    >
                      クリア
                    </button>
                  </div>
                )}

                {!previousFromQr && (
                  <PhotoSection
                    title="または前回の写真を追加"
                    images={previousImages}
                    onAdd={(files) => {
                      void addFiles(files, setPreviousImages).catch((err) => {
                        setErrorMessage(
                          err instanceof Error ? err.message : "画像の読み込みに失敗しました"
                        );
                        setPhase("error");
                      });
                    }}
                    onRemove={(id) =>
                      setPreviousImages((prev) => prev.filter((img) => img.id !== id))
                    }
                    accent="slate"
                  />
                )}
              </section>

              <PhotoSection
                title="② 今回のお薬手帳"
                images={currentImages}
                onAdd={(files) => {
                  void addFiles(files, setCurrentImages).catch((err) => {
                    setErrorMessage(
                      err instanceof Error ? err.message : "画像の読み込みに失敗しました"
                    );
                    setPhase("error");
                  });
                }}
                onRemove={(id) =>
                  setCurrentImages((prev) => prev.filter((img) => img.id !== id))
                }
                accent="indigo"
              />

              {phase === "error" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
                  <p className="font-semibold">比較に失敗しました</p>
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
                  前回と今回を比較する
                </button>
                {!canSubmit && (
                  <p className="text-center text-sm text-slate-400 mt-2">
                    前回（QRまたは写真）と、今回の写真が必要です
                  </p>
                )}
              </div>
            </>
          )}

          {phase === "loading" && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
              <p className="text-lg font-semibold text-slate-700">
                AIが前回と今回を比較しています…
              </p>
              <p className="text-sm text-slate-500 text-center">
                画像はサーバーに保存されません。しばらくお待ちください。
              </p>
            </section>
          )}

          {phase === "result" && result && (
            <>
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">比較結果</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      患者番号：
                      <span className="font-mono font-semibold text-slate-700">
                        {patientNumber || "（未入力）"}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xs">
                    AIによる参考情報です。必ず原本と照合してください。
                  </p>
                </div>

                <SummaryChips result={result} />

                <MedGroup
                  title="増えた薬"
                  emptyText="増えた薬はありません"
                  items={result.added}
                  tone="added"
                />
                <MedGroup
                  title="消えた薬"
                  emptyText="消えた薬はありません"
                  items={result.removed}
                  tone="removed"
                />
                <MedGroup
                  title="継続中の薬"
                  emptyText="継続中の薬はありません"
                  items={result.unchanged}
                  tone="unchanged"
                />

                {result.notes && (
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <span className="font-semibold">補足：</span>
                    {result.notes}
                  </p>
                )}
              </section>

              <MedicationQrPanel
                medications={qrMedications}
                patientNumber={patientNumber}
                createdAt={createdAt}
                caption="今回時点の薬一覧QR（次回の「前回」に使えます）"
              />

              <div className="flex flex-col gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => window.print()}
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

      {result && (
        <div className="print-only print-sheet">
          <header style={{ marginBottom: "16px", borderBottom: "2px solid #0f766e", paddingBottom: "8px" }}>
            <h1 style={{ fontSize: "18pt", margin: 0, color: "#0f766e" }}>お薬比較表（前回／今回）</h1>
            <p style={{ margin: "6px 0 0", fontSize: "11pt" }}>
              患者番号：<strong>{patientNumber || "（未入力）"}</strong>
              {"　"}作成日時：{createdAt ? formatDateTime(createdAt) : "—"}
            </p>
          </header>

          <PrintGroup title="増えた薬" items={result.added} tone="added" />
          <PrintGroup title="消えた薬" items={result.removed} tone="removed" />
          <PrintGroup title="継続中の薬" items={result.unchanged} tone="unchanged" />

          {result.notes && (
            <p style={{ marginTop: "12px", fontSize: "10pt" }}>
              <strong>補足：</strong>
              {result.notes}
            </p>
          )}

          <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
            <MedicationQrPanel
              medications={qrMedications}
              patientNumber={patientNumber}
              createdAt={createdAt}
              caption="次回比較用QR（今回時点）"
            />
          </div>

          <footer style={{ marginTop: "20px", fontSize: "9pt", color: "#64748b", borderTop: "1px solid #cbd5e1", paddingTop: "8px" }}>
            ※ 本表はAIによる参考情報です。診療判断の前に必ず原本と照合してください。患者情報は保存していません。QRに今回時点の薬一覧を格納しています。
          </footer>
        </div>
      )}
    </>
  );
}

function SummaryChips({ result }: { result: CompareResult }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-center">
        <p className="text-2xl font-bold text-emerald-700">{result.added.length}</p>
        <p className="text-xs font-semibold text-emerald-800 mt-1">増えた</p>
      </div>
      <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-3 text-center">
        <p className="text-2xl font-bold text-rose-700">{result.removed.length}</p>
        <p className="text-xs font-semibold text-rose-800 mt-1">消えた</p>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
        <p className="text-2xl font-bold text-slate-700">{result.unchanged.length}</p>
        <p className="text-xs font-semibold text-slate-600 mt-1">継続</p>
      </div>
    </div>
  );
}

function MedGroup({
  title,
  emptyText,
  items,
  tone,
}: {
  title: string;
  emptyText: string;
  items: MedicationItem[];
  tone: "added" | "removed" | "unchanged";
}) {
  const wrap =
    tone === "added"
      ? "border-emerald-200 bg-emerald-50/40"
      : tone === "removed"
        ? "border-rose-200 bg-rose-50/40"
        : "border-slate-200 bg-slate-50/60";
  const heading =
    tone === "added"
      ? "text-emerald-800"
      : tone === "removed"
        ? "text-rose-800"
        : "text-slate-700";

  return (
    <div className={`rounded-2xl border p-4 ${wrap}`}>
      <h3 className={`font-bold mb-3 ${heading}`}>
        {title}
        <span className="ml-2 text-sm font-medium opacity-80">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse min-w-[520px] bg-white">
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
              {items.map((med, i) => (
                <tr
                  key={`${tone}-${med.name}-${i}`}
                  className={`${rowClass(med.cautionLevel)} ${tone === "removed" ? "opacity-80" : ""}`}
                >
                  <td className="border border-slate-200 px-3 py-2 text-slate-500">
                    {i + 1}
                  </td>
                  <td className="border border-slate-200 px-3 py-2">
                    <div
                      className={`font-semibold text-slate-800 ${
                        tone === "removed" ? "line-through" : ""
                      }`}
                    >
                      {med.name}
                    </div>
                    {med.genericName && (
                      <div className="text-xs text-slate-500 mt-0.5">{med.genericName}</div>
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
    </div>
  );
}

function rowClass(level: MedicationItem["cautionLevel"]) {
  if (level === "high") return "bg-red-50";
  if (level === "medium") return "bg-amber-50/60";
  return "bg-white";
}

function PrintGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: MedicationItem[];
  tone: "added" | "removed" | "unchanged";
}) {
  const className =
    tone === "added" ? "compare-added" : tone === "removed" ? "compare-removed" : "compare-unchanged";

  return (
    <section style={{ marginBottom: "14px" }} className={className}>
      <h2 style={{ fontSize: "12pt", margin: "0 0 6px" }}>
        {title}（{items.length}）
      </h2>
      {items.length === 0 ? (
        <p style={{ fontSize: "10pt", color: "#64748b" }}>なし</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "6%" }}>#</th>
              <th style={{ width: "24%" }}>薬品名</th>
              <th style={{ width: "28%" }}>何の薬か</th>
              <th style={{ width: "32%" }}>歯科での注意</th>
              <th style={{ width: "10%" }}>注意度</th>
            </tr>
          </thead>
          <tbody>
            {items.map((med, i) => (
              <tr key={`print-${tone}-${med.name}-${i}`}>
                <td>{i + 1}</td>
                <td>
                  <strong style={tone === "removed" ? { textDecoration: "line-through" } : undefined}>
                    {med.name}
                  </strong>
                  {med.genericName ? (
                    <>
                      <br />
                      <span style={{ fontSize: "9pt", color: "#475569" }}>{med.genericName}</span>
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
    </section>
  );
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
    <span className={`inline-block text-xs font-bold px-2 py-1 rounded-md shrink-0 ${styles}`}>
      {cautionLabel(level)}
    </span>
  );
}

function formatDateTime(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
