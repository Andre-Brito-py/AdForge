"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Palette, Type, UploadCloud, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BrandKitPage() {
  const [loading, setLoading] = useState(false);
  
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [tone, setTone] = useState("");
  const [website, setWebsite] = useState("");

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Brand Kit atualizado com sucesso!");
    }, 1000);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <header>
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Brand Kit</h1>
            <p className="text-zinc-500 mt-1">Configure a identidade visual e verbal da sua marca para a IA seguir.</p>
          </div>
          <Button onClick={handleSave} disabled={loading} size="lg" className="rounded-full shadow-sm bg-zinc-900 h-12 px-8">
            <Save className="mr-2 h-4 w-4" /> {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        
        {/* Identidade Visual */}
        <div className="p-8 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <Palette className="h-5 w-5 text-zinc-400" /> Identidade Visual
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-sm font-semibold text-zinc-900 block">Logotipo</label>
              <div className="border-2 border-dashed border-zinc-200 rounded-2xl h-32 flex flex-col items-center justify-center hover:bg-zinc-50 transition-colors cursor-pointer text-zinc-500 hover:text-zinc-900">
                <UploadCloud className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium">Fazer upload do Logo (PNG/SVG)</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-900 block">Nome da Marca</label>
                <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Ex: Vysify" className="h-12 bg-zinc-50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-900 block">Cor Primária (Hex)</label>
                <div className="flex gap-4">
                  <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-12 w-20 p-1 cursor-pointer rounded-lg" />
                  <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-12 bg-zinc-50 flex-1 font-mono uppercase" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Identidade Verbal */}
        <div className="p-8">
          <h2 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-400" /> Identidade Verbal
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900 block">Tom de Voz da Marca</label>
              <Textarea 
                value={tone} 
                onChange={e => setTone(e.target.value)} 
                placeholder="Ex: Somos uma marca jovem, descontraída e inovadora. Falamos sempre de forma direta, sem termos técnicos difíceis."
                className="min-h-[120px] bg-zinc-50 p-4 text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900 block">Website Oficial</label>
              <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://suamarca.com" className="h-12 bg-zinc-50" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
