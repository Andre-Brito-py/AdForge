import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Configure S3 se as variáveis estiverem presentes
const useS3 = !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID;

const s3Client = useS3 ? new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT, // Essencial para R2 / Supabase / DigitalOcean
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  // forcePathStyle é útil para alguns provedores compatíveis (MinIO, R2 local)
  forcePathStyle: process.env.S3_ENDPOINT ? true : false,
}) : null;

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${uniqueSuffix}-${originalName}`;
    
    // Caminho 1: Upload para S3/R2/Supabase Storage (PRODUÇÃO)
    if (useS3 && s3Client) {
      const bucket = process.env.S3_BUCKET!;
      const fileKey = `uploads/${filename}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: buffer,
        ContentType: file.type,
        // ACL: "public-read" // Descomentar se o provedor exigir ACL explícita para links públicos
      }));

      // Assume que o endpoint público é algo como https://MEU_BUCKET.minio.com/uploads/arquivo.png
      // Ou forneça S3_PUBLIC_URL no .env
      const publicBaseUrl = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${bucket}`;
      const fileUrl = `${publicBaseUrl}/${fileKey}`;

      return NextResponse.json({ success: true, url: fileUrl });
    }
    
    // Caminho 2: Fallback para Local System (DESENVOLVIMENTO)
    const uploadDir = join(process.cwd(), "public", "uploads");
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    const path = join(uploadDir, filename);
    await writeFile(path, buffer);
    
    const fileUrl = `/uploads/${filename}`;

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, message: "Upload failed" }, { status: 500 });
  }
}
