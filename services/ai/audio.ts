import { randomUUID } from "crypto";
import { saveFile } from "@/lib/storage";
import { getAppConfig } from "@/lib/config";
import { wordsFromAlignment, type CaptionWord } from "@/lib/video-finish";

// ELEVENLABS_BASE_URL aponta para um servidor simulado nos testes locais.
const ELEVENLABS_BASE = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/$/, "");

export type Presenter = "female" | "male" | "none" | null | undefined;

interface Speech {
  buffer: Buffer;
  /** Tempo de cada palavra (para as legendas); null quando o provedor não informa. */
  words: CaptionWord[] | null;
}

async function elevenLabs(text: string, apiKey: string, presenter: Presenter): Promise<Speech> {
  const { settings } = await getAppConfig();
  // A voz acompanha quem aparece apresentando (com lip-sync, a pessoa "fala" a locução).
  const voiceId = presenter === "male" ? settings.elevenLabsVoiceIdMale : settings.elevenLabsVoiceId;
  // /with-timestamps devolve o áudio e o tempo de cada caractere: é o que sincroniza as legendas com a fala.
  const res = await fetch(`${ELEVENLABS_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  const data = (await res.json()) as {
    audio_base64?: string;
    alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
  };
  if (!data.audio_base64) throw new Error("ElevenLabs: resposta sem áudio");
  let words: CaptionWord[] | null = null;
  try {
    words = data.alignment?.characters?.length ? wordsFromAlignment(data.alignment) : null;
  } catch {
    words = null; // sem tempos: as legendas usam a estimativa pela duração
  }
  return { buffer: Buffer.from(data.audio_base64, "base64"), words };
}

async function openAiTts(text: string, apiKey: string, presenter: Presenter): Promise<Speech> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: text, voice: presenter === "male" ? "onyx" : "nova", response_format: "mp3" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), words: null };
}

/**
 * Gera a locução do roteiro (e, na ElevenLabs, o tempo de cada palavra para as legendas). Retorna null se
 * nenhum provedor de voz estiver configurado (a locução é um extra: o vídeo continua sendo entregue).
 */
export async function generateNarration(
  text: string,
  keys: { elevenLabsKey: string | null; openAiKey: string | null },
  workspaceId: string,
  presenter?: Presenter
): Promise<{ url: string; words: CaptionWord[] | null } | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!clean) return null;

  let speech: Speech | null = null;
  if (keys.elevenLabsKey) speech = await elevenLabs(clean, keys.elevenLabsKey, presenter);
  else if (keys.openAiKey) speech = await openAiTts(clean, keys.openAiKey, presenter);
  if (!speech) return null;

  const url = await saveFile(speech.buffer, `audio/${workspaceId}/${randomUUID()}.mp3`, "audio/mpeg");
  return { url, words: speech.words };
}
