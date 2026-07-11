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

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Edge / Node 両対応（Web Crypto） */
export async function createAuthToken(
  password: string,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`ok:${password}`)
  );
  return toHex(signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function isValidAuthToken(
  token: string | undefined,
  password: string,
  secret: string
): Promise<boolean> {
  if (!token) return false;
  const expected = await createAuthToken(password, secret);
  return timingSafeEqualHex(token, expected);
}
