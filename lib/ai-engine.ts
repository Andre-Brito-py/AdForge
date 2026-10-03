import type { AppConfig } from "./config";

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

export function hasTextProviderKey(config: Pick<AppConfig, "secrets">) {
  return !!config.secrets.geminiKey || !!config.secrets.openAiKey;
}
