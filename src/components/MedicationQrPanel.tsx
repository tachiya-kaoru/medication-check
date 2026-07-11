"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  encodeQrPayload,
  toQrPayload,
  type MedicationQrPayload,
} from "@/lib/medicationQr";
import type { MedicationItem } from "@/lib/types";

interface MedicationQrPanelProps {
  medications: MedicationItem[];
  patientNumber?: string;
  createdAt?: Date | null;
  /** 画面用の補足文 */
  caption?: string;
  /** 印刷ヘッダー向けの小さめ表示 */
  compact?: boolean;
}

export function MedicationQrPanel({
  medications,
  patientNumber,
  createdAt,
  caption = "次回比較用QR（サーバーには保存しません）",
  compact = false,
}: MedicationQrPanelProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState("");
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function build() {
      setError("");
      setTooLarge(false);
      try {
        const payload: MedicationQrPayload = toQrPayload(medications, {
          patientNumber,
          createdAt,
        });
        const text = encodeQrPayload(payload);
        // おおよそ Version 40 上限付近。超えると生成失敗しやすい
        if (text.length > 2500) {
          if (!cancelled) {
            setTooLarge(true);
            setDataUrl("");
          }
          return;
        }
        // 高解像度で生成し、表示は小さくする（読み取りやすさのため）
        const url = await QRCode.toDataURL(text, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 280,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "QRの生成に失敗しました");
          setDataUrl("");
        }
      }
    }

    void build();
    return () => {
      cancelled = true;
    };
  }, [medications, patientNumber, createdAt]);

  if (medications.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {tooLarge ? (
          <p className="text-[9pt] text-amber-700 text-center">QR作成不可</p>
        ) : error ? (
          <p className="text-[9pt] text-red-600 text-center">QRエラー</p>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="お薬情報QRコード"
            className="print-qr-img"
            width={96}
            height={96}
          />
        ) : (
          <div className="print-qr-img bg-slate-100" />
        )}
        <p className="text-[8pt] text-slate-500">次回比較用</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-slate-700 text-center">{caption}</p>
      {tooLarge ? (
        <p className="text-sm text-amber-700 text-center">
          薬の件数が多いためQRに入りきりませんでした。印刷表は利用できます。
        </p>
      ) : error ? (
        <p className="text-sm text-red-600 text-center">{error}</p>
      ) : dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="お薬情報QRコード"
          className="w-36 h-36"
          width={144}
          height={144}
        />
      ) : (
        <div className="w-36 h-36 bg-slate-100 animate-pulse rounded-lg" />
      )}
      <p className="text-xs text-slate-500 text-center">
        薬 {medications.length} 件をQRに格納
      </p>
    </div>
  );
}
