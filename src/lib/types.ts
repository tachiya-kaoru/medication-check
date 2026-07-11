export interface MedicationItem {
  name: string;
  genericName: string;
  purpose: string;
  dentalNotes: string;
  cautionLevel: "low" | "medium" | "high";
}

export interface AnalyzeResult {
  medications: MedicationItem[];
  notes: string;
}

export interface AnalyzeRequestImage {
  mimeType: string;
  data: string; // base64（data URLプレフィックスなし）
}
