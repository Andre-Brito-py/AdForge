import { GoogleGenAI } from "@google/genai";

/**
 * Cliente Gemini. GEMINI_BASE_URL permite apontar para um gateway/proxy
 * (ou um servidor simulado nos testes) sem mudar código.
 */
export function geminiClient(apiKey: string) {
  const baseUrl = process.env.GEMINI_BASE_URL;
  return new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}
