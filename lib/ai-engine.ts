import type { AppConfig } from "./config";
import { videoModelCaps } from "./video-models";

/**
 * Qual provedor gera as imagens (e o quadro de abertura dos vídeos), conforme Admin › IA e custos.
 * Se o escolhido não tiver chave, usa o outro; com OpenAI escolhida, o Gemini (se houver chave) é a reserva.
 */
export function imageEngine(config: Pick<AppConfig, "secrets" | "models">, premium: boolean) {
  const { secrets, models } = config;
  const useOpenAI = !!secrets.openAiKey && (models.imageProvider === "openai" || !secrets.geminiKey);
  return {
    apiKey: secrets.geminiKey || "",
    model: premium ? models.imagePremium : models.image,
    fallbackModel: models.image,
    openai: useOpenAI ? { apiKey: secrets.openAiKey!, model: premium ? models.openaiImagePremium : models.openaiImage } : null,
    /** Nome do modelo usado (para registrar no criativo). */
    label: useOpenAI ? (premium ? models.openaiImagePremium : models.openaiImage) : premium ? models.imagePremium : models.image,
    provider: useOpenAI ? ("openai" as const) : ("gemini" as const),
  };
}

export function hasImageProvider(config: Pick<AppConfig, "secrets">) {
  return !!config.secrets.geminiKey || !!config.secrets.openAiKey;
}

/** Chaves dos provedores de vídeo (fal.ai para Wan/Kling; Gemini para o Veo). */
export function videoKeys(config: Pick<AppConfig, "secrets">) {
  return { fal: config.secrets.wanKey, gemini: config.secrets.geminiKey };
}

/** O modelo de vídeo escolhido tem a chave do provedor dele configurada? */
export function hasVideoProvider(config: Pick<AppConfig, "secrets">, model: string) {
  return videoModelCaps(model).provider === "veo" ? !!config.secrets.geminiKey : !!config.secrets.wanKey;
}

export function hasTextProviderKey(config: Pick<AppConfig, "secrets">) {
  return !!config.secrets.geminiKey || !!config.secrets.openAiKey;
}
