"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Key, LayoutGrid, Users, Loader2, Sparkles, Database, Save, CreditCard } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ 
    geminiKey: "", openAiKey: "", oviKey: "", wanKey: "", elevenLabsKey: "",
    stripeSecretKey: "", stripeWebhookSecret: "", 
    mercadoPagoAccessToken: "", mercadoPagoWebhookSecret: "", 
    aiCostsJson: "", plansJson: "" 
  });
  
  // Mock Metrics
  const metrics = { users: 142, campaigns: 3840, generated: 15420, revenue: "R$ 4.250" };

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => r.json())
      .then(data => {
        if (data.config) setConfig({
          geminiKey: data.config.geminiKey || "",
          openAiKey: data.config.openAiKey || "",
          oviKey: data.config.oviKey || "",
          wanKey: data.config.wanKey || "",
          elevenLabsKey: data.config.elevenLabsKey || "",
          stripeSecretKey: data.config.stripeSecretKey || "",
          stripeWebhookSecret: data.config.stripeWebhookSecret || "",
          mercadoPagoAccessToken: data.config.mercadoPagoAccessToken || "",
          mercadoPagoWebhookSecret: data.config.mercadoPagoWebhookSecret || "",
          aiCostsJson: data.config.aiCostsJson || "",
          plansJson: data.config.plansJson || ""
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
    { id: "payments", label: "Gateways de Pagamento", icon: CreditCard },
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
                  <label className="text-sm font-semibold text-zinc-900 block">OpenAI API Key (Backup Geral)</label>
                  <Input type="password" value={config.openAiKey} onChange={e => setConfig({...config, openAiKey: e.target.value})} className="h-12 bg-zinc-50 font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900 block">OVI API Key (Legado)</label>
                  <Input type="password" value={config.oviKey} onChange={e => setConfig({...config, oviKey: e.target.value})} className="h-12 bg-zinc-50 font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900 block text-purple-600">Wan 2.1 (Video S2V / Fal.ai / Replicate)</label>
                  <Input type="password" value={config.wanKey || ""} onChange={e => setConfig({...config, wanKey: e.target.value})} className="h-12 bg-zinc-50 font-mono border-purple-200" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900 block text-blue-600">ElevenLabs API Key (TTS / Voz)</label>
                  <Input type="password" value={config.elevenLabsKey || ""} onChange={e => setConfig({...config, elevenLabsKey: e.target.value})} className="h-12 bg-zinc-50 font-mono border-blue-200" />
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Configuração de Planos (Paywall)</h2>
                  <p className="text-sm text-zinc-500 mt-1">Estes planos aparecerão diretamente na página inicial e de faturamento.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    let currentPlans = [];
                    try { currentPlans = JSON.parse(config.plansJson || "[]"); } catch(e){}
                    const newPlan = {
                      id: `plan_${Date.now()}`,
                      name: "Novo Plano",
                      price_brl: 0,
                      price_usd: 0,
                      credits: 100,
                      isFeatured: false,
                      features_pt: ["100 Créditos"],
                      features_en: ["100 Credits"]
                    };
                    setConfig({ ...config, plansJson: JSON.stringify([...currentPlans, newPlan], null, 2) });
                  }}
                >
                  + Adicionar Plano
                </Button>
              </div>
              
              <div className="space-y-6">
                {(() => {
                  let plans = [];
                  try { plans = JSON.parse(config.plansJson || "[]"); } catch(e){}
                  
                  if (!Array.isArray(plans) || plans.length === 0) {
                    return <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-500">Nenhum plano configurado. Adicione um para começar.</div>;
                  }

                  return plans.map((plan, index) => (
                    <div key={plan.id || index} className={`p-6 rounded-2xl border ${plan.isFeatured ? 'border-violet-500 bg-violet-50/30' : 'border-zinc-200 bg-white'} relative`}>
                      <button 
                        onClick={() => {
                          const newPlans = [...plans];
                          newPlans.splice(index, 1);
                          setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                        }}
                        className="absolute top-4 right-4 text-xs font-bold text-red-500 hover:text-red-700"
                      >
                        Remover
                      </button>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-zinc-500 block mb-1">Nome do Plano</label>
                            <Input 
                              value={plan.name || ""} 
                              onChange={(e) => {
                                const newPlans = [...plans];
                                newPlans[index].name = e.target.value;
                                setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                              }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-zinc-500 block mb-1">Preço (R$)</label>
                              <Input 
                                type="number" 
                                value={plan.price_brl || 0} 
                                onChange={(e) => {
                                  const newPlans = [...plans];
                                  newPlans[index].price_brl = Number(e.target.value);
                                  setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-zinc-500 block mb-1">Preço ($ USD)</label>
                              <Input 
                                type="number" 
                                value={plan.price_usd || 0} 
                                onChange={(e) => {
                                  const newPlans = [...plans];
                                  newPlans[index].price_usd = Number(e.target.value);
                                  setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                              <label className="text-xs font-semibold text-zinc-500 block mb-1">Créditos Inclusos</label>
                              <Input 
                                type="number" 
                                value={plan.credits || 0} 
                                onChange={(e) => {
                                  const newPlans = [...plans];
                                  newPlans[index].credits = Number(e.target.value);
                                  setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                                }}
                              />
                            </div>
                            <div className="flex items-center h-10 gap-2">
                              <input 
                                type="checkbox" 
                                id={`featured-${index}`}
                                checked={plan.isFeatured || false}
                                onChange={(e) => {
                                  const newPlans = [...plans];
                                  newPlans[index].isFeatured = e.target.checked;
                                  setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                                }}
                                className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-600"
                              />
                              <label htmlFor={`featured-${index}`} className="text-sm font-semibold text-zinc-700 cursor-pointer">Destaque (Mais Popular)</label>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-zinc-500 block mb-1">Benefícios (PT-BR) - Um por linha</label>
                            <Textarea 
                              rows={4}
                              value={(plan.features_pt || []).join('\n')}
                              onChange={(e) => {
                                const newPlans = [...plans];
                                newPlans[index].features_pt = e.target.value.split('\n');
                                setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                              }}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-zinc-500 block mb-1">Benefícios (EN-US) - Um por linha</label>
                            <Textarea 
                              rows={4}
                              value={(plan.features_en || []).join('\n')}
                              onChange={(e) => {
                                const newPlans = [...plans];
                                newPlans[index].features_en = e.target.value.split('\n');
                                setConfig({ ...config, plansJson: JSON.stringify(newPlans, null, 2) });
                              }}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={loading} size="lg" className="rounded-full bg-red-600 hover:bg-red-700 px-8">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Planos
                </Button>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="p-8 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Gateways de Pagamento</h2>
                <p className="text-sm text-zinc-500 mt-1">Configure suas chaves do Stripe e Mercado Pago para processar cobranças.</p>
              </div>
              
              <div className="space-y-6">
                <div className="p-6 border border-zinc-200 rounded-2xl bg-zinc-50/50 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 bg-[#635BFF] rounded flex items-center justify-center text-white font-bold text-xs">S</div>
                    <h3 className="font-bold text-zinc-900">Stripe (Cobranças Globais / USD)</h3>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900 block">Stripe Secret Key (sk_live_... ou sk_test_...)</label>
                    <Input type="password" value={config.stripeSecretKey} onChange={e => setConfig({...config, stripeSecretKey: e.target.value})} className="h-12 bg-white font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900 block">Stripe Webhook Secret (whsec_...)</label>
                    <Input type="password" value={config.stripeWebhookSecret} onChange={e => setConfig({...config, stripeWebhookSecret: e.target.value})} className="h-12 bg-white font-mono" />
                    <p className="text-xs text-zinc-500 mt-1">Crie um Webhook no Stripe apontando para: <code>https://seudominio.com/api/webhooks/stripe</code></p>
                  </div>
                </div>

                <div className="p-6 border border-zinc-200 rounded-2xl bg-zinc-50/50 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 bg-[#009EE3] rounded flex items-center justify-center text-white font-bold text-xs">MP</div>
                    <h3 className="font-bold text-zinc-900">Mercado Pago (Cobranças Locais / PIX)</h3>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900 block">Access Token (APP_USR-...)</label>
                    <Input type="password" value={config.mercadoPagoAccessToken} onChange={e => setConfig({...config, mercadoPagoAccessToken: e.target.value})} className="h-12 bg-white font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900 block">Webhook Secret</label>
                    <Input type="password" value={config.mercadoPagoWebhookSecret} onChange={e => setConfig({...config, mercadoPagoWebhookSecret: e.target.value})} className="h-12 bg-white font-mono" />
                    <p className="text-xs text-zinc-500 mt-1">Crie um Webhook no Mercado Pago apontando para: <code>https://seudominio.com/api/webhooks/mercadopago</code></p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={loading} size="lg" className="rounded-full bg-red-600 hover:bg-red-700 px-8">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Chaves
                </Button>
              </div>
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
