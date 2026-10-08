import { getAppConfig } from "@/lib/config";
import { toDataUri } from "@/lib/storage";
import { isBillingMessage, reportProviderProblem } from "@/lib/admin-alerts";
import { generateTextContent, isTransient } from "./gemini-client";

/**
 * Chamada central de IA de texto/visão com resposta em JSON (estratégia, moderação, revisões, direção de cena).
 * Usa o provedor escolhido em Admin › IA e custos e, se ele falhar, o outro (quando houver chave).
 * Erros "de conteúdo" (ex.: JSON inválido) não trocam de provedor; quem chama decide o que fazer.
 */

export type Img = { buffer: Buffer; mimeType: string };
export class NoTextProviderError extends Error {
  constructor() {
    super("Nenhum provedor de texto configurado.");
    this.name = "NoTextProviderError";
  }
}

const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, "");

async function withGemini(apiKey: string, model: string, prompt: string, images: Img[], temperature: number) {
  const response = await generateTextContent(apiKey, {
    model,
    contents: [
      {
        role: "user",
        // Cada imagem vem precedida do número dela ("Image 1", "Image 2"...), como os prompts as citam.
        parts: [{ text: prompt }, ...images.flatMap((img, i) => [{ text: `Image ${i + 1}:` }, { inlineData: { data: img.buffer.toString("base64"), mimeType: img.mimeType } }])],
      },
    ],
    config: { responseMimeType: "application/json", temperature },
  });
  return response.text || "";
}

/** OpenAI Responses API (modelos atuais com visão), saída em JSON. */
async function withOpenAI(apiKey: string, model: string, prompt: string, images: Img[]) {
  const body = {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...images.flatMap((img, i) => [
            { type: "input_text", text: `Image ${i + 1}:` },
            { type: "input_image", image_url: toDataUri(img.buffer, img.mimeType) },
          ]),
        ],
      },
    ],
    text: { format: { type: "json_object" } },
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${OPENAI_BASE}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.output || [])
        .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content || [])
        .filter((c: { type: string }) => c.type === "output_text")
        .map((c: { text?: string }) => c.text || "")
        .join("");
      return text;
    }
    lastError = Object.assign(new Error(`OpenAI ${res.status}: ${data?.error?.message || ""}`.slice(0, 400)), { status: res.status, message: `${data?.error?.message || ""}` });
    if (!isTransient(lastError) || attempt === 2) break;
    await new Promise((r) => setTimeout(r, attempt === 0 ? 2_000 : 6_000));
  }
  throw lastError;
}

/** Ordem de provedores: o escolhido no Admin primeiro; o outro como reserva, se tiver chave. */
export async function textProviders() {
  const { secrets, models } = await getAppConfig();
  const all = [
    secrets.geminiKey ? { name: "gemini" as const, key: secrets.geminiKey, model: models.text } : null,
    secrets.openAiKey ? { name: "openai" as const, key: secrets.openAiKey, model: models.openaiText } : null,
  ].filter((p): p is NonNullable<typeof p> => !!p);
  return all.sort((a, b) => (a.name === models.textProvider ? -1 : b.name === models.textProvider ? 1 : 0));
}

export async function hasTextProvider() {
  return (await textProviders()).length > 0;
}

/**
 * Pede um JSON ao provedor de texto (com imagens opcionais) e devolve o texto bruto da resposta.
 * `parse` valida a resposta: se lançar erro de formato, tenta o próximo provedor antes de desistir.
 */
export async function generateJson<T>(opts: { prompt: string; images?: Img[]; temperature?: number; parse: (raw: string) => T }): Promise<T> {
  const providers = await textProviders();
  if (providers.length === 0) throw new NoTextProviderError();
  let lastError: unknown;
  for (const p of providers) {
    try {
      const raw = p.name === "gemini"
        ? await withGemini(p.key, p.model, opts.prompt, opts.images || [], opts.temperature ?? 0.7)
        : await withOpenAI(p.key, p.model, opts.prompt, opts.images || []);
      return opts.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch (error) {
      // Recusas de política/escopo vêm do parse e não devem trocar de provedor.
      if ((error as { keepProvider?: boolean })?.keepProvider) throw error;
      console.error(`[ai/llm] ${p.name} falhou`, error);
      // Sem saldo/chave recusada: avisa o admin mesmo que o outro provedor salve esta chamada.
      const message = error instanceof Error ? error.message : String(error);
      if (isBillingMessage(message)) {
        await reportProviderProblem(p.name === "gemini" ? "google" : "openai", message).catch(() => undefined);
      }
      lastError = error;
    }
  }
  throw lastError;
}
