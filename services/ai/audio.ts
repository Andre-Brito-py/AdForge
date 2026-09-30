import { db } from "@/lib/db";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const useS3 = !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID;

const s3Client = useS3 ? new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_ENDPOINT ? true : false,
}) : null;

export async function generateAudio(text: string): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { id: "global" } });
  
  if (config?.elevenLabsKey) {
    return generateWithElevenLabs(text, config.elevenLabsKey);
  } else if (config?.openAiKey) {
    return generateWithOpenAITTS(text, config.openAiKey);
  }
  
  throw new Error("Nenhuma API de Áudio (ElevenLabs ou OpenAI) configurada.");
}

async function generateWithElevenLabs(text: string, apiKey: string): Promise<string> {
  const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Bella
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Accept": "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs Error: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return saveAudioFile(buffer, "elevenlabs");
}

async function generateWithOpenAITTS(text: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: "alloy",
      response_format: "mp3"
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI TTS Error: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return saveAudioFile(buffer, "openai");
}

async function saveAudioFile(buffer: Buffer, provider: string): Promise<string> {
  const fileName = `tts-${provider}-${randomUUID()}.mp3`;

  if (useS3 && s3Client) {
    const bucket = process.env.S3_BUCKET!;
    const fileKey = `audio/${fileName}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: "audio/mpeg",
    }));

    const publicBaseUrl = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${bucket}`;
    return `${publicBaseUrl}/${fileKey}`;
  }
  
  // Fallback Local
  const uploadDir = join(process.cwd(), "public", "uploads", "audio");
  try { mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
  
  const filePath = join(uploadDir, fileName);
  writeFileSync(filePath, buffer);
  
  return `/uploads/audio/${fileName}`;
}
