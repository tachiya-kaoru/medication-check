"use client";

import Link from "next/link";

interface AppHeaderProps {
  current: "analyze" | "compare";
}

export function AppHeader({ current }: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-sm">
      <div className="max-w-2xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-teal-700 tracking-wide">お薬情報整理</h1>
          <p className="text-sm text-slate-500 mt-0.5">院内専用システム</p>
        </div>
        <nav className="flex gap-2">
          <Link
            href="/"
            className={`flex-1 sm:flex-none text-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              current === "analyze"
                ? "bg-teal-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            お薬表作成
          </Link>
          <Link
            href="/compare"
            className={`flex-1 sm:flex-none text-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              current === "compare"
                ? "bg-teal-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            前回比較
          </Link>
        </nav>
      </div>
    </header>
  );
}
