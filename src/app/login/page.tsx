"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "ログインに失敗しました");
      }
      const from = searchParams.get("from") || "/";
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col gap-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-teal-700">お薬情報整理</h1>
          <p className="text-sm text-slate-500 mt-1">院内専用ログイン</p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-700">パスワード</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-300 focus:border-teal-500 focus:outline-none px-4 py-4 text-lg text-slate-800"
            placeholder="院内パスワード"
            required
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className={`w-full rounded-2xl py-4 text-lg font-semibold text-white transition-colors ${
            loading || !password
              ? "bg-slate-300 cursor-not-allowed"
              : "bg-teal-600 hover:bg-teal-700"
          }`}
        >
          {loading ? "確認中…" : "ログイン"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          一度ログインすると、しばらく再入力不要です。
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          読み込み中…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
