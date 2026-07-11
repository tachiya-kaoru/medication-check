import { ThinkingLevel } from "@google/genai";

/** お薬読み取り用の共通 Gemini 設定（案C: 3.1 Flash-Lite + thinking minimal） */
export const GEMINI_MODEL = "gemini-3.1-flash-lite";

const medicationItemSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    genericName: { type: "string" },
    purpose: { type: "string" },
    dentalNotes: { type: "string" },
    cautionLevel: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["name", "genericName", "purpose", "dentalNotes", "cautionLevel"],
};

export const analyzeResponseSchema = {
  type: "object",
  properties: {
    medications: {
      type: "array",
      items: medicationItemSchema,
    },
    notes: { type: "string" },
  },
  required: ["medications", "notes"],
};

export const compareResponseSchema = {
  type: "object",
  properties: {
    added: { type: "array", items: medicationItemSchema },
    removed: { type: "array", items: medicationItemSchema },
    unchanged: { type: "array", items: medicationItemSchema },
    notes: { type: "string" },
  },
  required: ["added", "removed", "unchanged", "notes"],
};

export function buildGeminiConfig(responseJsonSchema: object) {
  return {
    responseMimeType: "application/json" as const,
    responseJsonSchema,
    temperature: 0.2,
    // お薬名抽出は速度優先（案C）。精度が気になる場合は gemini-3.5-flash に戻す
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MINIMAL,
    },
  };
}
