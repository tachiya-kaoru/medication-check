"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PhotoCameraModalProps {
  open: boolean;
  onClose: () => void;
  /** JPEG data URL を返す */
  onCapture: (dataUrl: string) => void;
}

/**
 * iOS の `<input capture>` はカメラ終了後にページが止まって onChange が落ちることがある。
 * アプリ内カメラなら撮った直後にそのまま黒塗りへ進める。
 */
export function PhotoCameraModal({ open, onClose, onCapture }: PhotoCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [message, setMessage] = useState("カメラを準備しています…");

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setStatus("starting");
    setMessage("カメラを準備しています…");

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setStatus("error");
          setMessage("この端末ではアプリ内カメラを使えません。ライブラリから選んでください。");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
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
        setStatus("ready");
        setMessage("お薬手帳を枠に入れて撮影してください");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("カメラを起動できませんでした。許可を確認するか、ライブラリから選んでください。");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  const handleShutter = useCallback(() => {
    const video = videoRef.current;
    if (!video || status !== "ready") return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    // 黒塗り・送信用に長辺を抑える（メモリ対策）
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    onCapture(dataUrl);
  }, [onCapture, status, stopCamera]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="カメラ撮影"
    >
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <div className="absolute left-0 right-0 top-0 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="rounded-2xl bg-slate-900/85 px-4 py-3 text-center text-sm font-medium text-white">
            {message}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {status === "ready" && (
          <button
            type="button"
            onClick={handleShutter}
            className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-teal-500 shadow-lg active:bg-teal-600"
            style={{ height: 72, width: 72 }}
            aria-label="撮影する"
          >
            <span className="h-14 w-14 rounded-full bg-white" style={{ height: 56, width: 56 }} />
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
