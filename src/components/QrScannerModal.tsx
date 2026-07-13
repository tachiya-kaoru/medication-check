"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decodeMedicationQrFromImageData,
  decodeMedicationQrFromFile,
  type DecodedMedicationQr,
} from "@/lib/decodeMedicationQr";

type ScanStatus = "starting" | "scanning" | "success" | "error";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDecoded: (decoded: DecodedMedicationQr) => void;
}

export function QrScannerModal({ open, onClose, onDecoded }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const successLockRef = useRef(false);
  const lastUnsupportedAtRef = useRef(0);

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [statusMessage, setStatusMessage] = useState("カメラを準備しています…");
  const [cameraFailed, setCameraFailed] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const finishSuccess = useCallback(
    (decoded: DecodedMedicationQr) => {
      if (successLockRef.current) return;
      successLockRef.current = true;
      setStatus("success");
      setStatusMessage(`読み取りました（薬 ${decoded.medications.length} 件）`);
      try {
        navigator.vibrate?.(40);
      } catch {
        /* ignore */
      }
      stopCamera();
      window.setTimeout(() => {
        onDecoded(decoded);
        onClose();
      }, 900);
    },
    [onClose, onDecoded, stopCamera]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || successLockRef.current) return;

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // 中央付近をやや大きめに切り出して判定（枠内に合わせやすくする）
    const side = Math.min(width, height) * 0.72;
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;
    const size = Math.round(side);

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);

    try {
      const decoded = decodeMedicationQrFromImageData(imageData);
      if (decoded) {
        finishSuccess(decoded);
        return;
      }
    } catch (err) {
      const now = Date.now();
      if (now - lastUnsupportedAtRef.current > 1800) {
        lastUnsupportedAtRef.current = now;
        setStatus("error");
        setStatusMessage(
          err instanceof Error
            ? err.message
            : "このQRには対応していません。印刷したお薬表のQRをかざしてください。"
        );
        window.setTimeout(() => {
          if (!successLockRef.current) {
            setStatus("scanning");
            setStatusMessage("枠の中にQRコードを合わせてください");
          }
        }, 1600);
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [finishSuccess]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let cancelled = false;
    successLockRef.current = false;
    setStatus("starting");
    setStatusMessage("カメラを準備しています…");
    setCameraFailed(false);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraFailed(true);
          setStatus("error");
          setStatusMessage("この端末ではカメラを直接起動できません。下のボタンから写真を選んでください。");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        setStatus("scanning");
        setStatusMessage("枠の中にQRコードを合わせてください");
        rafRef.current = requestAnimationFrame(scanFrame);
      } catch {
        if (!cancelled) {
          setCameraFailed(true);
          setStatus("error");
          setStatusMessage(
            "カメラを使えませんでした。許可を確認するか、下のボタンからQRの写真を選んでください。"
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, scanFrame, stopCamera]);

  const handleFile = useCallback(
    async (files: File[]) => {
      if (!files.length || successLockRef.current) return;
      setStatus("starting");
      setStatusMessage("写真から読み取り中…");
      try {
        const decoded = await decodeMedicationQrFromFile(files[0]);
        finishSuccess(decoded);
      } catch (err) {
        setStatus("error");
        setStatusMessage(
          err instanceof Error ? err.message : "QRの読み取りに失敗しました"
        );
      }
    },
    [finishSuccess]
  );

  if (!open) return null;

  const frameClass =
    status === "success"
      ? "border-emerald-400 shadow-[0_0_0_9999px_rgba(6,78,59,0.55)]"
      : status === "error"
        ? "border-amber-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.72)]"
        : "border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.72)]";

  const bannerClass =
    status === "success"
      ? "bg-emerald-600 text-white"
      : status === "error"
        ? "bg-amber-100 text-amber-950"
        : "bg-slate-900/85 text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="QRコード読み取り"
    >
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {/* 中央の読み取り枠 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`relative h-[min(68vw,280px)] w-[min(68vw,280px)] rounded-2xl border-4 transition-colors duration-300 ${frameClass}`}
          >
            <span className="absolute -left-0.5 -top-0.5 h-8 w-8 border-l-4 border-t-4 border-teal-300 rounded-tl-xl" />
            <span className="absolute -right-0.5 -top-0.5 h-8 w-8 border-r-4 border-t-4 border-teal-300 rounded-tr-xl" />
            <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 border-b-4 border-l-4 border-teal-300 rounded-bl-xl" />
            <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 border-b-4 border-r-4 border-teal-300 rounded-br-xl" />

            {status === "scanning" && (
              <div className="absolute inset-3 overflow-hidden rounded-xl">
                <div className="qr-scan-line absolute inset-x-0 h-0.5 bg-teal-300/90" />
              </div>
            )}

            {status === "success" && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/35">
                <p className="rounded-full bg-emerald-500 px-4 py-2 text-base font-bold text-white shadow-lg">
                  読み取り完了
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-0 right-0 top-0 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className={`rounded-2xl px-4 py-3 text-center text-sm font-medium ${bannerClass}`}>
            {statusMessage}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <p className="text-center text-xs text-slate-400">
          印刷したお薬表の右上QRを、枠いっぱいに近づけてください。反応したら自動で閉じます。
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const list = e.target.files;
            const files = list ? Array.from(list) : [];
            e.target.value = "";
            void handleFile(files);
          }}
        />

        {(cameraFailed || status === "error") && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:bg-teal-700"
          >
            写真から読み取る
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="w-full rounded-2xl border border-slate-600 py-4 text-lg font-semibold text-slate-100 active:bg-slate-800"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
