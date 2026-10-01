"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";

const MAX_MB = 8;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

/** Seleção de imagem com arrastar-e-soltar, pré-visualização e validação no cliente. */
export function ImageDropzone({
  file,
  onChange,
  label = "Arraste a foto aqui ou clique para escolher",
  aspect = "aspect-[4/3]",
}: {
  file: File | null;
  onChange: (file: File | null, error?: string) => void;
  label?: string;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return onChange(null, "Use uma imagem PNG, JPG ou WEBP.");
    if (f.size > MAX_MB * 1024 * 1024) return onChange(null, `A imagem pode ter no máximo ${MAX_MB} MB.`);
    onChange(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
      className={`relative ${aspect} w-full overflow-hidden rounded-2xl border-2 border-dashed transition ${
        dragging ? "border-brand bg-brand-soft" : "border-border bg-muted/40 hover:border-foreground/30"
      }`}
    >
      <input ref={input} type="file" accept={ACCEPT.join(",")} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Pré-visualização" className="h-full w-full object-contain" />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-background/90 px-3 py-1.5 text-xs font-medium shadow backdrop-blur hover:bg-background"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Trocar
          </button>
        </>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">PNG, JPG ou WEBP · até {MAX_MB} MB</span>
        </button>
      )}
    </div>
  );
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha no upload da imagem");
  return data.url as string;
}
