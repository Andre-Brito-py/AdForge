"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Key, LayoutGrid, Users, Loader2, Sparkles, Database } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ geminiKey: "", oviKey: "", aiCostsJson: "", plansJson: "" });
  
  // Mock Metrics
  const metrics = { users: 142, campaigns: 3840, generated: 15420, revenue: "R$ 4.250" };

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => r.json())
      .then(data => {
        if (data) setConfig({
          geminiKey: data.geminiKey || "",
          oviKey: data.oviKey || "",
          aiCostsJson: data.aiCostsJson || "",
          plansJson: data.plansJson || ""
        });
      }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error();
      toast.success("Configurações Globais Salvas!");
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: "dashboard", label: "Visão Geral", icon: LayoutGrid },
    { id: "users", label: "Usuários & Tenants", icon: Users },
    { id: "ai", label: "Modelos e Chaves de IA", icon: Key },
    { id: "sales", label: "Planos e Paywall", icon: Database },
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <header>
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">God Mode (Super Admin)</h1>
            <p className="text-zinc-500 text-sm mt-1">Acesso irrestrito aos parâmetros centrais da plataforma.</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.id ? "bg-red-600 text-white shadow-md" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 w-full bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[500px]">
          
          {activeTab === "dashboard" && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Métricas da Plataforma</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-6 border border-zinc-100 rounded-2xl bg-zinc-50">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase">Total de Usuários</h3>
                  <p className="text-4xl font-extrabold text-zinc-900 mt-2">{metrics.users}</p>
                </div>
                <div className="p-6 border border-zinc-100 rounded-2xl bg-zinc-50">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase">MRR (Faturamento)</h3>
                  <p className="text-4xl font-extrabold text-emerald-600 mt-2">{metrics.revenue}</p>
                </div>
                <div className="p-6 border border-zinc-100 rounded-2xl bg-zinc-50">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase">Campanhas Geradas</h3>
                  <p className="text-4xl font-extrabold text-zinc-900 mt-2">{metrics.campaigns}</p>
                </div>
                <div className="p-6 border border-zinc-100 rounded-2xl bg-zinc-50">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase">Criativos (AI Calls)</h3>
                  <p className="text-4xl font-extrabold text-zinc-900 mt-2">{metrics.generated}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="p-8 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Provedores de Inteligência Artificial</h2>
                <p className="text-sm text-zinc-500 mt-1">Configure as chaves e provedores (Google, OVI, OpenAI).</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900 block">Gemini API Key (Text & Strategy)</label>
                  <Input type="password" value={config.geminiKey} onChange={e => setConfig({...config, geminiKey: e.target.value})} className="h-12 bg-zinc-50 font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900 block">OVI API Key (Image/Video Gen)</label>
                  <Input type="password" value={config.oviKey} onChange={e => setConfig({...config, oviKey: e.target.value})} className="h-12 bg-zinc-50 font-mono" />
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <h2 className="text-xl font-bold text-zinc-900">Custos Internos da IA (em Créditos)</h2>
                <p className="text-sm text-zinc-500 mt-1 mb-4">Defina quanto custa CADA chamada para repassar ao usuário.</p>
                <Textarea 
                  value={config.aiCostsJson} 
                  onChange={e => setConfig({...config, aiCostsJson: e.target.value})}
                  className="min-h-[150px] font-mono text-sm bg-zinc-900 text-emerald-400 p-4 rounded-xl"
                  placeholder='{ "image": 3, "video": 10, "text": 1 }'
                />
              </div>

              <Button onClick={handleSave} disabled={loading} size="lg" className="rounded-full bg-red-600 hover:bg-red-700 px-8">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Configurações
              </Button>
            </div>
          )}

          {activeTab === "sales" && (
            <div className="p-8 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Configuração de Planos (Paywall)</h2>
                <p className="text-sm text-zinc-500 mt-1">Estes planos aparecerão diretamente na página /billing dos usuários.</p>
              </div>
              
              <Textarea 
                value={config.plansJson} 
                onChange={e => setConfig({...config, plansJson: e.target.value})}
                className="min-h-[300px] font-mono text-sm bg-zinc-900 text-emerald-400 p-4 rounded-xl leading-relaxed"
                placeholder='[ { "id": "pro", "name": "Profissional", "price_brl": 99, "price_usd": 19, "price_eur": 18, "credits": 800, "isFeatured": true } ]'
              />

              <Button onClick={handleSave} disabled={loading} size="lg" className="rounded-full bg-red-600 hover:bg-red-700 px-8">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Planos
              </Button>
            </div>
          )}

          {activeTab === "users" && (
            <div className="p-8 text-center py-20">
              <Users className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-900">Tabela de Usuários (Em Breve)</h2>
              <p className="text-sm text-zinc-500 mt-2">Aqui você poderá bloquear contas, reembolsar créditos e assumir sessão.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
