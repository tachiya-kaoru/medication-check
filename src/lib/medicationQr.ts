import type { MedicationItem } from "@/lib/types";

/** QRに載せるコンパクト形式（サーバー保存なし・紙にデータを持たせる） */
export interface MedicationQrPayload {
  v: 1;
  /** med = お薬一覧（比較の「今回時点」にも使う） */
  t: "med";
  /** 作成日 YYYY-MM-DD */
  d: string;
  /** 患者番号（任意） */
  p?: string;
  m: Array<{
    n: string;
    g?: string;
    u?: string;
    dn?: string;
    c?: "low" | "medium" | "high";
  }>;
}

export function toQrPayload(
  medications: MedicationItem[],
  options?: { patientNumber?: string; createdAt?: Date | null }
): MedicationQrPayload {
  const createdAt = options?.createdAt ?? new Date();
  const d = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;
  const patientNumber = options?.patientNumber?.trim();

  return {
    v: 1,
    t: "med",
    d,
    ...(patientNumber ? { p: patientNumber } : {}),
    m: medications.map((med) => ({
      n: med.name,
      ...(med.genericName ? { g: med.genericName } : {}),
      ...(med.purpose && med.purpose !== "—" ? { u: med.purpose } : {}),
      ...(med.dentalNotes ? { dn: med.dentalNotes } : {}),
      ...(med.cautionLevel !== "low" ? { c: med.cautionLevel } : {}),
    })),
  };
}

export function encodeQrPayload(payload: MedicationQrPayload): string {
  return JSON.stringify(payload);
}

export function decodeQrPayload(text: string): MedicationQrPayload {
  const raw = JSON.parse(text) as Partial<MedicationQrPayload>;
  if (raw.v !== 1 || raw.t !== "med" || !Array.isArray(raw.m)) {
    throw new Error("対応していないQRコードです");
  }
  return raw as MedicationQrPayload;
}

export function payloadToMedications(payload: MedicationQrPayload): MedicationItem[] {
  return payload.m.map((item) => ({
    name: String(item.n ?? "").trim() || "（名称不明）",
    genericName: String(item.g ?? "").trim(),
    purpose: String(item.u ?? "").trim() || "—",
    dentalNotes: String(item.dn ?? "").trim(),
    cautionLevel:
      item.c === "high" || item.c === "medium" || item.c === "low" ? item.c : "low",
  }));
}

/** 比較結果から「今回時点の薬一覧」（継続＋増加）を作る */
export function currentMedicationsFromCompare(result: {
  added: MedicationItem[];
  unchanged: MedicationItem[];
}): MedicationItem[] {
  const map = new Map<string, MedicationItem>();
  for (const med of [...result.unchanged, ...result.added]) {
    const key = `${med.name}::${med.genericName}`.toLowerCase();
    map.set(key, med);
  }
  return Array.from(map.values());
}
