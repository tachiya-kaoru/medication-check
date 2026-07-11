export type LoadingStep = "preparing" | "uploading" | "analyzing";

const ANALYZE_COPY: Record<LoadingStep, { title: string; detail: string }> = {
  preparing: {
    title: "画像を準備しています…",
    detail: "送信サイズを整えています。",
  },
  uploading: {
    title: "サーバーへ送信しています…",
    detail: "画像は保存されません。",
  },
  analyzing: {
    title: "AIがお薬情報を読み取っています…",
    detail: "枚数が多いほど時間がかかります。しばらくお待ちください。",
  },
};

const COMPARE_COPY: Record<LoadingStep, { title: string; detail: string }> = {
  preparing: {
    title: "画像を準備しています…",
    detail: "送信サイズを整えています。",
  },
  uploading: {
    title: "サーバーへ送信しています…",
    detail: "画像は保存されません。",
  },
  analyzing: {
    title: "AIが前回と今回を比較しています…",
    detail:
      "前回→今回の順に読み取ります。枚数が多いと時間がかかります。",
  },
};

interface LoadingPanelProps {
  mode: "analyze" | "compare";
  step: LoadingStep;
}

export function LoadingPanel({ mode, step }: LoadingPanelProps) {
  const copy = (mode === "analyze" ? ANALYZE_COPY : COMPARE_COPY)[step];

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      <p className="text-lg font-semibold text-slate-700">{copy.title}</p>
      <p className="text-sm text-slate-500 text-center">{copy.detail}</p>
      <ol className="flex gap-2 mt-1 text-xs text-slate-400">
        {(
          [
            ["preparing", "準備"],
            ["uploading", "送信"],
            ["analyzing", "解析"],
          ] as const
        ).map(([key, label]) => {
          const order = ["preparing", "uploading", "analyzing"] as const;
          const activeIndex = order.indexOf(step);
          const itemIndex = order.indexOf(key);
          const done = itemIndex < activeIndex;
          const active = itemIndex === activeIndex;
          return (
            <li
              key={key}
              className={
                active
                  ? "font-semibold text-teal-700"
                  : done
                    ? "text-teal-500"
                    : ""
              }
            >
              {done ? "✓ " : ""}
              {label}
              {itemIndex < order.length - 1 ? " →" : ""}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
