import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_DAYS,
  createAuthToken,
  getAuthSecret,
  getSitePassword,
} from "@/lib/siteAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const configured = getSitePassword();
  if (!configured) {
    return NextResponse.json(
      { error: "SITE_PASSWORD が設定されていません" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const password = body.password ?? "";
  if (password !== configured) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const token = createAuthToken(configured, getAuthSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE_DAYS * 24 * 60 * 60,
  });
  return res;
}
