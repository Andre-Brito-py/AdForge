"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ImagePlus } from "lucide-react";
import Link from "next/link";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [brandName, setBrandName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !file) {
      toast.error("Nome e Imagem são obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload mockado localmente
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Erro no upload");
      const uploadData = await uploadRes.json();
      
      // 2. Salvar Produto no Banco
      const prodRes = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          category,
          brandName,
          targetAudience,
          price: price ? parseFloat(price) : null,
          imageUrl: uploadData.url
        })
      });

      if (!prodRes.ok) throw new Error("Erro ao salvar produto");
      
      const prodData = await prodRes.json();
      toast.success("Produto cadastrado com sucesso!");
      router.push(`/products/${prodData.id}`);

    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao cadastrar o produto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      
      <header>
        <Link href="/products" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Biblioteca
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Adicionar Novo Produto</h1>
        <p className="text-zinc-500 mt-2 text-lg">Quanto mais detalhes você fornecer, melhores serão os criativos gerados pela IA.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 md:p-10 rounded-3xl border border-zinc-200 shadow-sm">
        
        {/* Basic Info */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-zinc-900 border-b border-zinc-100 pb-4">Informações Básicas</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900">Nome do Produto <span className="text-red-500">*</span></label>
              <Input 
                required 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Ex: Tênis Nike Air Max"
                className="h-12 bg-zinc-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900">Foto do Produto <span className="text-red-500">*</span></label>
              <div className="relative">
                <Input 
                  type="file" 
                  required 
                  accept="image/*"
                  onChange={e => setFile(e.target.files?.[0] || null)} 
                  className="h-12 pt-3 pl-10 cursor-pointer bg-zinc-50"
                />
                <ImagePlus className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-500">Uma foto clara e bem iluminada do seu produto.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-900">Descrição</label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Descreva o que é o produto, seus principais benefícios e características..."
              className="min-h-[120px] bg-zinc-50"
            />
          </div>
        </div>

        {/* Advanced Info */}
        <div className="space-y-6 pt-6">
          <h2 className="text-xl font-bold text-zinc-900 border-b border-zinc-100 pb-4">Detalhes para IA (Opcional)</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900">Categoria</label>
              <Input 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                placeholder="Ex: Moda, Beleza, Eletrônicos"
                className="h-12 bg-zinc-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900">Marca (Brand)</label>
              <Input 
                value={brandName} 
                onChange={e => setBrandName(e.target.value)} 
                placeholder="Ex: Nike"
                className="h-12 bg-zinc-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900">Público-Alvo</label>
              <Input 
                value={targetAudience} 
                onChange={e => setTargetAudience(e.target.value)} 
                placeholder="Ex: Jovens esportistas, 18-35 anos"
                className="h-12 bg-zinc-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-900">Preço (R$)</label>
              <Input 
                type="number"
                step="0.01"
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                placeholder="Ex: 299.90"
                className="h-12 bg-zinc-50"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 flex justify-end">
          <Button type="submit" size="lg" disabled={loading} className="rounded-full px-8 h-12">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {loading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </form>
    </div>
  );
}
