import { randomUUID } from "crypto";
import { saveFile } from "@/lib/storage";
import { getAppConfig } from "@/lib/config";

// ELEVENLABS_BASE_URL aponta para um servidor simulado nos testes locais.
const ELEVENLABS_BASE = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/$/, "");

async function elevenLabs(text: string, apiKey: string): Promise<Buffer> {
  const voiceId = (await getAppConfig()).settings.elevenLabsVoiceId;
  const res = await fetch(`${ELEVENLABS_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { Accept: "audio/mpeg", "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openAiTts(text: string, apiKey: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: text, voice: "alloy", response_format: "mp3" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Gera a locução do roteiro. Retorna null se nenhum provedor de voz estiver configurado
 * (a locução é um extra: o vídeo continua sendo entregue).
 */
export async function generateNarration(
  text: string,
  keys: { elevenLabsKey: string | null; openAiKey: string | null },
  workspaceId: string
): Promise<string | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!clean) return null;

  let buffer: Buffer | null = null;
  if (keys.elevenLabsKey) buffer = await elevenLabs(clean, keys.elevenLabsKey);
  else if (keys.openAiKey) buffer = await openAiTts(clean, keys.openAiKey);
  if (!buffer) return null;

  return saveFile(buffer, `audio/${workspaceId}/${randomUUID()}.mp3`, "audio/mpeg");
}
