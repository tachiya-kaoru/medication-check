import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE_NAME = "medication_auth";

/** ログイン維持日数（院内タブレット向け） */
export const AUTH_MAX_AGE_DAYS = 30;

export function getSitePassword(): string | undefined {
  const value = process.env.SITE_PASSWORD?.trim();
  return value || undefined;
}

export function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.SITE_PASSWORD?.trim() ||
    "dev-only-auth-secret"
  );
}

export function createAuthToken(password: string, secret: string): string {
  return createHmac("sha256", secret).update(`ok:${password}`).digest("hex");
}

export function isValidAuthToken(
  token: string | undefined,
  password: string,
  secret: string
): boolean {
  if (!token) return false;
  const expected = createAuthToken(password, secret);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
