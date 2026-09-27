"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, Download, RefreshCw, Copy, Image as ImageIcon, 
  Video, FileText, CheckCircle2, CircleDashed, AlertCircle, LayoutGrid, Sparkles
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export default function CreativeGalleryClient({ campaign }: { campaign: any }) {
  const [filter, setFilter] = useState("ALL"); // ALL, IMAGE, VIDEO, COPY
  const [selectedCreative, setSelectedCreative] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");

  const visuals = campaign.creatives.filter((c: any) => c.type === "IMAGE" || c.type === "VIDEO");
  const copies = campaign.creatives.filter((c: any) => c.type === "COPY");

  // Paridade de visual com copy (para criar "Ad Sets" lógicos na UI)
  const adSets = visuals.map((visual: any, index: number) => ({
    visual,
    copy: copies[index] || copies[0] || null
  }));

  const filteredSets = filter === "ALL" 
    ? adSets 
    : adSets.filter((set: any) => set.visual.type === filter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "GENERATING":
      case "PROCESSING": return <CircleDashed className="h-4 w-4 text-blue-500 animate-spin" />;
      case "FAILED": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <CircleDashed className="h-4 w-4 text-zinc-400" />;
    }
  };

  const handleDownload = (url: string, filename: string) => {
    toast.success("Download iniciado!");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Texto copiado para a área de transferência!");
  };

  const openEditor = (set: any) => {
    setSelectedCreative(set);
    setEditedPrompt(set.visual.prompt || "");
    setIsModalOpen(true);
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    // Aqui faríamos a chamada real para regenerar apenas este criativo
    setTimeout(() => {
      setGenerating(false);
      setIsModalOpen(false);
      toast.success("Nova versão gerada e adicionada à campanha!");
      // window.location.reload(); 
    }, 2000);
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-8">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Painel
          </Link>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">{campaign.name}</h1>
            <div className="flex items-center gap-2 bg-white border border-zinc-200 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
              {getStatusIcon(campaign.status)}
              <span className="text-zinc-700">{campaign.status}</span>
            </div>
          </div>
          <p className="text-zinc-500 text-lg flex items-center gap-2">
            Produto: <span className="font-semibold text-zinc-900">{campaign.product.name}</span>
            <span className="text-zinc-300">•</span>
            Criada {dayjs(campaign.createdAt).fromNow()}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-full shadow-sm">
            <Copy className="mr-2 h-4 w-4" /> Duplicar Campanha
          </Button>
          <Button className="rounded-full shadow-sm bg-zinc-900">
            <Sparkles className="mr-2 h-4 w-4" /> Gerar Mais Variações
          </Button>
        </div>
      </header>

      {/* FILTROS E CONTEÚDO */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[500px]">
        
        {/* TABS */}
        <div className="border-b border-zinc-100 p-4 flex gap-2 overflow-x-auto">
          <button onClick={() => setFilter("ALL")} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${filter === "ALL" ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"}`}>
            <LayoutGrid className="h-4 w-4" /> Todos ({adSets.length})
          </button>
          <button onClick={() => setFilter("IMAGE")} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${filter === "IMAGE" ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"}`}>
            <ImageIcon className="h-4 w-4" /> Imagens ({visuals.filter((v:any) => v.type === "IMAGE").length})
          </button>
          <button onClick={() => setFilter("VIDEO")} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${filter === "VIDEO" ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"}`}>
            <Video className="h-4 w-4" /> Vídeos ({visuals.filter((v:any) => v.type === "VIDEO").length})
          </button>
        </div>

        {/* GRID */}
        <div className="p-6 md:p-8">
          {filteredSets.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center">
              <Sparkles className="h-10 w-10 text-zinc-300 mb-4" />
              <h3 className="text-lg font-bold text-zinc-900">Nenhum criativo encontrado</h3>
              <p className="text-zinc-500">Tente alterar os filtros ou gere novas variações.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredSets.map((set: any, idx: number) => (
                <div key={set.visual.id} className="group flex flex-col">
                  {/* VISUAL CARD */}
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 aspect-[4/5] shadow-sm group-hover:shadow-lg transition-all">
                    {set.visual.type === "IMAGE" ? (
                      <img src={set.visual.outputUrl || campaign.product.originalImageUrl} alt="Creative" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white">
                        <Video className="h-12 w-12 opacity-50" />
                        <span className="absolute bottom-4 left-4 text-xs font-bold bg-black/50 px-2 py-1 rounded backdrop-blur">VÍDEO MOCK</span>
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-zinc-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4 backdrop-blur-[2px]">
                      <div className="flex justify-between">
                        <span className="bg-white/90 text-zinc-900 text-xs font-bold px-2 py-1 rounded-full shadow">
                          {set.visual.aspectRatio || "1:1"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleDownload(set.visual.outputUrl || campaign.product.originalImageUrl, `creative-${idx}.jpg`)} className="flex-1 bg-white text-zinc-900 hover:bg-zinc-100 shadow-xl">
                          <Download className="mr-2 h-4 w-4" /> Baixar
                        </Button>
                        <Button size="sm" onClick={() => openEditor(set)} className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 shadow-xl">
                          <RefreshCw className="mr-2 h-4 w-4" /> Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* COPY TEXT BELOW */}
                  {set.copy && (
                    <div className="mt-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm text-zinc-600 leading-relaxed relative group/copy">
                      <p className="line-clamp-4">{set.copy.outputUrl}</p>
                      <button onClick={() => handleCopy(set.copy.outputUrl)} className="absolute top-2 right-2 p-2 bg-white rounded-lg shadow-sm border border-zinc-100 opacity-0 group-hover/copy:opacity-100 transition-opacity hover:bg-zinc-50 text-zinc-900">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CREATIVE EDITOR MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-zinc-50 rounded-3xl">
          <div className="grid md:grid-cols-2 h-full min-h-[500px]">
            
            {/* Esquerda: Preview */}
            <div className="bg-zinc-100 border-r border-zinc-200 p-8 flex items-center justify-center relative">
              {selectedCreative?.visual?.type === "IMAGE" ? (
                <img src={selectedCreative.visual.outputUrl || campaign.product.originalImageUrl} className="rounded-xl shadow-2xl max-h-full object-contain" />
              ) : (
                 <div className="w-full aspect-[9/16] max-h-full bg-zinc-900 rounded-xl flex items-center justify-center shadow-2xl">
                    <Video className="h-12 w-12 text-white/50" />
                 </div>
              )}
            </div>

            {/* Direita: Controles estilo Linear */}
            <div className="p-8 flex flex-col bg-white">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-bold tracking-tight text-zinc-900">Editar Criativo</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Prompt / Direção de Arte</label>
                  <Textarea 
                    value={editedPrompt}
                    onChange={e => setEditedPrompt(e.target.value)}
                    className="min-h-[100px] bg-zinc-50"
                  />
                  <p className="text-xs text-zinc-500">Altere as instruções para gerar uma variação com a mesma base estrutural.</p>
                </div>
                
                {selectedCreative?.copy && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900 flex items-center justify-between">
                      Copy Sugerido
                      <button onClick={() => handleCopy(selectedCreative.copy.outputUrl)} className="text-blue-600 hover:underline">Copiar</button>
                    </label>
                    <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl text-sm text-zinc-700 h-32 overflow-y-auto">
                      {selectedCreative.copy.outputUrl}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 mt-6 border-t border-zinc-100 flex flex-col gap-3">
                <Button size="lg" onClick={handleRegenerate} disabled={generating} className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 shadow-md">
                  {generating ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  {generating ? "Recriando com IA..." : "Gerar Nova Versão (3 CR)"}
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button variant="secondary" className="w-full rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">Criar 5 Variações</Button>
                </div>
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
