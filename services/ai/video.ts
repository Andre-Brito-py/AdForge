import { db } from "@/lib/db";

export interface VideoGenOptions {
  imageUrl: string;
  audioUrl?: string;     // Se enviado, usa pipeline S2V (Speech-to-Video) com Wan / Lip-sync
  prompt: string;
  aspectRatio: string;
  quality?: "standard" | "premium";
}

export async function generateVideo(options: VideoGenOptions): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { id: "global" } });
  
  // O provedor preferencial agora é Wan 2.1
  const wanKey = config?.wanKey;
  const oviKey = config?.oviKey;
  const apiKey = wanKey || oviKey;

  // Se houvesse chave válida, chamaríamos a API (ex: fal.ai para Wan 2.1)
  // Para MVP/Teste, vamos logar a simulação e retornar um vídeo ou a imagem como fallback.
  console.log("🎬 [Wan 2.1 / S2V Video Generator] Iniciando...");
  console.log(`- Imagem Base: ${options.imageUrl}`);
  if (options.audioUrl) {
    console.log(`- Áudio (Lip-sync): ${options.audioUrl}`);
    console.log(`- Modo: Speech-to-Video (S2V) ativado. Sincronizando lábios...`);
  } else {
    console.log(`- Modo: Image-to-Video (I2V) ativado. Sem fala.`);
  }
  console.log(`- Prompt: ${options.prompt}`);
  
  // Simulador de Delay (2 segundos)
  await new Promise(r => setTimeout(r, 2000));
  
  // Em produção, isso bateria numa API como:
  // await fetch("https://fal.run/fal-ai/wan-v2.1", { method: "POST", body: ... })
  
  // Retornamos a imagem estática como fallback de visualização no MVP
  // No futuro, podemos retornar um .mp4 gerado.
  return options.imageUrl;
}
