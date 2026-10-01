"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, buttonClass } from "@/components/app/ui-bits";
import { ImageDropzone, uploadImage } from "@/components/app/image-dropzone";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", brandName: "", targetAudience: "", price: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Adicione a foto do produto.");
    if (!form.name.trim()) return toast.error("Informe o nome do produto.");

    setLoading(true);
    try {
      const imageUrl = await uploadImage(file);
      const price = form.price ? Number(form.price.replace(",", ".")) : null;
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number.isFinite(price) ? price : null, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar o produto");
      toast.success("Produto cadastrado!");
      router.push(`/products/${data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Produtos" }}
        title="Adicionar produto"
        description="Quanto mais contexto você der, melhores ficam os anúncios."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <span className="label-base">Foto do produto *</span>
          <ImageDropzone file={file} onChange={(f, err) => { if (err) toast.error(err); setFile(f); }} />
          <p className="text-xs text-muted-foreground">
            Dica: fundo simples, produto inteiro no quadro e boa iluminação. Envie apenas imagens de produtos que você tem direito de usar.
          </p>
        </div>

        <div className="surface space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <label htmlFor="name" className="label-base">Nome do produto *</label>
            <input id="name" className="input-base" value={form.name} onChange={set("name")} maxLength={120} placeholder="Ex.: Garrafa térmica inox 750 ml" required />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="label-base">Descrição e benefícios</label>
            <textarea id="description" className="input-base min-h-28 py-3" value={form.description} onChange={set("description")} maxLength={2000} placeholder="O que é, para quem serve, diferenciais, materiais..." />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="category" className="label-base">Categoria</label>
              <input id="category" className="input-base" value={form.category} onChange={set("category")} maxLength={80} placeholder="Ex.: Casa e cozinha" />
            </div>
            <div className="space-y-2">
              <label htmlFor="brand" className="label-base">Marca</label>
              <input id="brand" className="input-base" value={form.brandName} onChange={set("brandName")} maxLength={80} placeholder="Ex.: Termix" />
            </div>
            <div className="space-y-2">
              <label htmlFor="audience" className="label-base">Público-alvo</label>
              <input id="audience" className="input-base" value={form.targetAudience} onChange={set("targetAudience")} maxLength={300} placeholder="Ex.: quem treina e trabalha fora" />
            </div>
            <div className="space-y-2">
              <label htmlFor="price" className="label-base">Preço (R$)</label>
              <input id="price" className="input-base" inputMode="decimal" value={form.price} onChange={set("price")} placeholder="Ex.: 89,90" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className={buttonClass("brand", "lg")}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Salvando..." : "Salvar produto"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
