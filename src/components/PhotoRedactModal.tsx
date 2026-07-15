"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PhotoRedactModalProps {
  imageDataUrl: string;
  pageIndex: number;
  pageTotal: number;
  onConfirm: (redactedDataUrl: string) => void;
  onCancel: () => void;
}

export function PhotoRedactModal({
  imageDataUrl,
  pageIndex,
  pageTotal,
  onConfirm,
  onCancel,
}: PhotoRedactModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef<{ startX: number; startY: number } | null>(null);
  const currentRectRef = useRef<Rect | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const rectsRef = useRef<Rect[]>([]);

  // rectsRef を常に最新に同期（イベントハンドラから最新 rects を読むため）
  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);

  const redrawCanvas = useCallback(
    (rectList: Rect[], current: Rect | null) => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = "#000000";
      for (const r of rectList) {
        if (r.w > 0 && r.h > 0) ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      if (current && current.w > 0 && current.h > 0) {
        ctx.fillRect(current.x, current.y, current.w, current.h);
      }
    },
    []
  );

  // 画像が変わるたびにキャンバスを初期化
  useEffect(() => {
    setRects([]);
    rectsRef.current = [];
    currentRectRef.current = null;
    drawingRef.current = null;

    const img = new window.Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      redrawCanvas([], null);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, redrawCanvas]);

  // rects 変更時に再描画
  useEffect(() => {
    redrawCanvas(rects, currentRectRef.current);
  }, [rects, redrawCanvas]);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const br = canvas.getBoundingClientRect();
      const scaleX = canvas.width / br.width;
      const scaleY = canvas.height / br.height;
      let clientX: number;
      let clientY: number;
      if ("touches" in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        clientX = t.clientX;
        clientY = t.clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      return {
        x: (clientX - br.left) * scaleX,
        y: (clientY - br.top) * scaleY,
      };
    },
    []
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const { x, y } = getCanvasCoords(e);
      drawingRef.current = { startX: x, startY: y };
      currentRectRef.current = { x, y, w: 0, h: 0 };
    },
    [getCanvasCoords]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      const { x, y } = getCanvasCoords(e);
      const { startX, startY } = drawingRef.current;
      const rect: Rect = {
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        w: Math.abs(x - startX),
        h: Math.abs(y - startY),
      };
      currentRectRef.current = rect;
      redrawCanvas(rectsRef.current, rect);
    },
    [getCanvasCoords, redrawCanvas]
  );

  const handleEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!drawingRef.current || !currentRectRef.current) return;
      const rect = { ...currentRectRef.current };
      drawingRef.current = null;
      currentRectRef.current = null;
      // 小さすぎる（誤タップ）は無視
      if (rect.w > 8 && rect.h > 8) {
        setRects((prev) => [...prev, rect]);
      } else {
        redrawCanvas(rectsRef.current, null);
      }
    },
    [redrawCanvas]
  );

  const handleUndo = useCallback(() => {
    setRects((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setRects([]);
  }, []);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  }, [onConfirm]);

  const isLast = pageIndex === pageTotal;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="写真の確認と黒塗り"
    >
      {/* ヘッダー */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 text-white">
        <p className="text-sm font-semibold">
          {pageTotal > 1 ? `${pageIndex} / ${pageTotal}枚目` : "写真を確認"}
        </p>
        <p className="text-xs text-slate-400 text-right">
          隠したい部分をドラッグして黒塗りできます
        </p>
      </div>

      {/* キャンバス */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-900 p-2">
        <canvas
          ref={canvasRef}
          className="max-w-full touch-none cursor-crosshair block"
          style={{ maxHeight: "calc(100dvh - 190px)" }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      {/* ボトム操作 */}
      <div className="shrink-0 bg-slate-950 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleUndo}
            disabled={rects.length === 0}
            className="flex-1 rounded-2xl border border-slate-600 py-3 text-base font-semibold text-slate-100 active:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            1つ戻す
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={rects.length === 0}
            className="flex-1 rounded-2xl border border-slate-600 py-3 text-base font-semibold text-slate-100 active:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            全て消す
          </button>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-600 py-4 text-lg font-semibold text-slate-100 active:bg-slate-800"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-[2] rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:bg-teal-700"
          >
            {pageTotal > 1 && !isLast ? "OK・次へ" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
